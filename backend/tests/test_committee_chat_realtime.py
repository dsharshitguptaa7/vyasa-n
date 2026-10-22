# -*- coding: utf-8 -*-
"""
Unit tests for VYASA / NIVARAN-AI Committee Real-Time Chat WebSocket Infrastructure.

Verifies:
1. Short-lived single-use ticket lifecycle (creation, consumption, single-use burn, expiration, committee mismatch).
2. Committee room isolation: broadcasts to committee A never reach committee B.
3. Multi-client broadcast delivery: multiple sockets in the same room receive events.
4. Resilient connection management: slow or disconnected sockets are safely pruned without crashing or blocking peers.
5. Empty room cleanup when all clients disconnect.
6. Rate-limiting: rapid successive messages trigger rate limit flag.
7. Event envelope and ACK/Error frame formats.
8. Payload validation: rejecting empty or oversized messages (>5000 chars).
9. Persistence-before-broadcast contract: exceptions during database persistence abort broadcast.
"""

import asyncio
import time
import uuid
from datetime import datetime, timezone
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from pydantic import ValidationError

from app.modules.atharva_veda.nivaran.services.committee_chat_ws import (
    CommitteeChatConnectionManager,
    committee_chat_manager,
)
from app.modules.atharva_veda.nivaran.schemas.committee import (
    CommitteeMessageCreatePayload,
    CommitteeMessageResponseItem,
)
from app.modules.atharva_veda.nivaran.models.enums import CommitteeMessageType


# -------------------------------------------------------------
# 1. Single-Use Ticket Lifecycle Tests
# -------------------------------------------------------------

def test_chat_ticket_creation_and_consumption():
    mgr = CommitteeChatConnectionManager()
    user_id = uuid.uuid4()
    authority_id = uuid.uuid4()
    committee_id = uuid.uuid4()

    ticket = mgr.create_chat_ticket(user_id, authority_id, committee_id, ttl_seconds=60)
    assert isinstance(ticket, str)
    assert len(ticket) >= 32

    # First consumption: valid
    res = mgr.consume_chat_ticket(ticket, committee_id)
    assert res is not None
    assert res == (user_id, authority_id)

    # Second consumption: burned / single-use fails
    res_second = mgr.consume_chat_ticket(ticket, committee_id)
    assert res_second is None


def test_chat_ticket_wrong_committee_rejected():
    mgr = CommitteeChatConnectionManager()
    user_id = uuid.uuid4()
    authority_id = uuid.uuid4()
    comm_a = uuid.uuid4()
    comm_b = uuid.uuid4()

    ticket = mgr.create_chat_ticket(user_id, authority_id, comm_a, ttl_seconds=60)
    # Attempting to use comm_a ticket in comm_b must fail
    res = mgr.consume_chat_ticket(ticket, comm_b)
    assert res is None


def test_chat_ticket_expired_rejected():
    mgr = CommitteeChatConnectionManager()
    user_id = uuid.uuid4()
    authority_id = uuid.uuid4()
    comm = uuid.uuid4()

    # Expired ticket (ttl = -1 second)
    ticket = mgr.create_chat_ticket(user_id, authority_id, comm, ttl_seconds=-1)
    res = mgr.consume_chat_ticket(ticket, comm)
    assert res is None


# -------------------------------------------------------------
# 2. Room Isolation & Multi-Client Broadcast Tests
# -------------------------------------------------------------

def test_room_isolation_between_committees():
    async def _run():
        mgr = CommitteeChatConnectionManager()
        comm_a = uuid.uuid4()
        comm_b = uuid.uuid4()

        ws_a1 = AsyncMock()
        ws_a2 = AsyncMock()
        ws_b = AsyncMock()

        u1, a1 = uuid.uuid4(), uuid.uuid4()
        u2, a2 = uuid.uuid4(), uuid.uuid4()
        u3, a3 = uuid.uuid4(), uuid.uuid4()

        await mgr.connect(comm_a, ws_a1, u1, a1, accept=False)
        await mgr.connect(comm_a, ws_a2, u2, a2, accept=False)
        await mgr.connect(comm_b, ws_b, u3, a3, accept=False)

        assert mgr.get_room_member_count(comm_a) == 2
        assert mgr.get_room_member_count(comm_b) == 1

        payload_a = {"type": "chat_message", "text": "Hello Comm A"}
        await mgr.broadcast(comm_a, payload_a)

        # Both clients in Comm A received the broadcast
        ws_a1.send_json.assert_awaited_once_with(payload_a)
        ws_a2.send_json.assert_awaited_once_with(payload_a)

        # Client in Comm B received NOTHING from Comm A
        ws_b.send_json.assert_not_awaited()

    asyncio.run(_run())


def test_disconnect_and_empty_room_cleanup():
    async def _run():
        mgr = CommitteeChatConnectionManager()
        comm = uuid.uuid4()
        ws = AsyncMock()
        u, a = uuid.uuid4(), uuid.uuid4()

        await mgr.connect(comm, ws, u, a, accept=False)
        assert comm in mgr._rooms
        assert mgr.get_room_member_count(comm) == 1

        mgr.disconnect(comm, ws)
        assert comm not in mgr._rooms
        assert mgr.get_room_member_count(comm) == 0

    asyncio.run(_run())


def test_dead_connection_pruning_during_broadcast():
    async def _run():
        mgr = CommitteeChatConnectionManager()
        comm = uuid.uuid4()

        ws_healthy = AsyncMock()
        ws_dead = AsyncMock()
        ws_dead.send_json.side_effect = Exception("Connection reset by peer")

        await mgr.connect(comm, ws_healthy, uuid.uuid4(), uuid.uuid4(), accept=False)
        await mgr.connect(comm, ws_dead, uuid.uuid4(), uuid.uuid4(), accept=False)
        assert mgr.get_room_member_count(comm) == 2

        payload = {"type": "chat_message", "text": "Broadcast test"}
        await mgr.broadcast(comm, payload)

        # Healthy client got the message
        ws_healthy.send_json.assert_awaited_once_with(payload)
        # Dead client failed and was automatically pruned
        assert mgr.get_room_member_count(comm) == 1
        assert ws_dead not in mgr._rooms[comm]

    asyncio.run(_run())


# -------------------------------------------------------------
# 3. Rate Limiting Tests
# -------------------------------------------------------------

def test_rate_limiting_sliding_window():
    mgr = CommitteeChatConnectionManager()
    comm = uuid.uuid4()
    ws = MagicMock()

    # Manually populate connection
    from app.modules.atharva_veda.nivaran.services.committee_chat_ws import ConnectionMetadata
    mgr._rooms[comm] = {ws: ConnectionMetadata(user_id=uuid.uuid4(), authority_id=uuid.uuid4())}

    # Burst 5 messages within limit (max=5, window=2s)
    for _ in range(5):
        assert mgr.is_rate_limited(comm, ws, max_messages=5, window_seconds=2.0) is False

    # 6th message exceeds limit
    assert mgr.is_rate_limited(comm, ws, max_messages=5, window_seconds=2.0) is True


# -------------------------------------------------------------
# 4. ACK and Error Frame Protocols
# -------------------------------------------------------------

def test_send_error_and_ack_frames():
    async def _run():
        mgr = CommitteeChatConnectionManager()
        ws = AsyncMock()

        await mgr.send_error(ws, "VALIDATION_ERROR", "Message cannot be empty.")
        ws.send_json.assert_awaited_once()
        err_call = ws.send_json.call_args[0][0]
        assert err_call["type"] == "error"
        assert err_call["error_code"] == "VALIDATION_ERROR"
        assert err_call["detail"] == "Message cannot be empty."

        ws.reset_mock()
        await mgr.send_ack(ws, message_id="msg-1234", client_msg_id="client-999")
        ws.send_json.assert_awaited_once()
        ack_call = ws.send_json.call_args[0][0]
        assert ack_call["type"] == "message_ack"
        assert ack_call["message_id"] == "msg-1234"
        assert ack_call["client_msg_id"] == "client-999"

    asyncio.run(_run())


# -------------------------------------------------------------
# 5. Schema Validation & Persistence Contracts
# -------------------------------------------------------------

def test_message_schema_validation():
    # Valid payload
    valid = CommitteeMessageCreatePayload(message_text="Formal inspection scheduled.")
    assert valid.message_text == "Formal inspection scheduled."

    # Empty payload rejected
    with pytest.raises(ValidationError):
        CommitteeMessageCreatePayload(message_text="")

    # Oversized payload (>5000 chars) rejected
    with pytest.raises(ValidationError):
        CommitteeMessageCreatePayload(message_text="A" * 5001)


def test_persistence_before_broadcast_guarantee():
    """
    Verifies that if database persistence fails, no broadcast is emitted.
    """
    async def _run():
        from app.modules.atharva_veda.nivaran.services.committee_service import CommitteeService

        comm_id = uuid.uuid4()
        mock_db = MagicMock()
        mock_db.commit.side_effect = Exception("DB Disk I/O Error")

        mock_user = MagicMock()
        mock_user.id = uuid.uuid4()

        mock_auth = MagicMock()
        mock_auth.id = uuid.uuid4()
        mock_auth.name_snapshot = "Dr. Test Authority"
        mock_auth.role.value = "ASSOCIATE_DEAN"
        mock_auth.designation = "Associate Dean"

        mock_comm = MagicMock()
        mock_comm.id = comm_id
        mock_comm.status.value = "ACTIVE"

        payload = CommitteeMessageCreatePayload(message_text="This will fail to save.")

        with patch.object(CommitteeService, "validate_committee_access", return_value=(mock_auth, mock_comm, None)):
            with patch.object(committee_chat_manager, "broadcast", new_callable=AsyncMock) as mock_broadcast:
                with pytest.raises(Exception, match="DB Disk I/O Error"):
                    await CommitteeService.post_message_async(
                        db=mock_db,
                        committee_id=comm_id,
                        user=mock_user,
                        payload=payload,
                    )
                # Broadcast was NEVER called because persistence failed
                mock_broadcast.assert_not_called()

    asyncio.run(_run())


# -------------------------------------------------------------
# 6. WebSocket Authentication & Query-Token Rejection Regressions
# -------------------------------------------------------------

import jwt
from fastapi import HTTPException, status
from app.core.config import settings
from app.modules.atharva_veda.nivaran.router import committee_chat_websocket
from app.modules.atharva_veda.nivaran.services.committee_service import CommitteeService


def _make_mock_user_and_auth():
    mock_user = MagicMock()
    mock_user.id = uuid.uuid4()
    mock_user.is_active = True

    mock_auth = MagicMock()
    mock_auth.id = uuid.uuid4()
    mock_auth.vyasa_user_id = mock_user.id
    mock_auth.name_snapshot = "Dr. Test Authority"
    mock_auth.role.value = "ASSOCIATE_DEAN"
    mock_auth.designation = "Associate Dean"
    mock_auth.is_active = True

    return mock_user, mock_auth


def _make_test_jwt(user_id: uuid.UUID) -> str:
    return jwt.encode(
        {"sub": str(user_id), "exp": time.time() + 3600},
        settings.SECRET_KEY,
        algorithm=settings.ALGORITHM,
    )


def test_ws_rejects_query_token_regression():
    """
    REGRESSION TEST: Passing a JWT token via ?token=<jwt> query parameter MUST BE STRICTLY REJECTED.
    WebSocket close code 1008 (WS_1008_POLICY_VIOLATION) must be issued without accepting connection.
    """
    async def _run():
        mock_user, mock_auth = _make_mock_user_and_auth()
        token = _make_test_jwt(mock_user.id)
        comm_id = uuid.uuid4()

        mock_ws = AsyncMock()
        mock_ws.query_params = {"token": token}
        mock_ws.headers = {}
        mock_ws.cookies = {}
        mock_ws.accept = AsyncMock()
        mock_ws.close = AsyncMock()

        mock_db = MagicMock()

        await committee_chat_websocket(websocket=mock_ws, committee_id=comm_id, db=mock_db)

        # Connection was rejected with 1008
        mock_ws.close.assert_awaited_once_with(code=status.WS_1008_POLICY_VIOLATION)
        mock_ws.accept.assert_not_awaited()

    asyncio.run(_run())


def test_ws_accepts_valid_ticket_query_param():
    """
    Verifies that a valid, short-lived single-use ticket in ?ticket=<ticket> is accepted.
    """
    async def _run():
        mock_user, mock_auth = _make_mock_user_and_auth()
        comm_id = uuid.uuid4()

        ticket = committee_chat_manager.create_chat_ticket(
            user_id=mock_user.id,
            authority_id=mock_auth.id,
            committee_id=comm_id,
            ttl_seconds=60,
        )

        mock_ws = AsyncMock()
        mock_ws.query_params = {"ticket": ticket}
        mock_ws.headers = {}
        mock_ws.cookies = {}
        mock_ws.accept = AsyncMock()
        mock_ws.close = AsyncMock()
        mock_ws.send_json = AsyncMock()
        # Abort while loop after connection established
        mock_ws.receive_json.side_effect = Exception("Client disconnect")

        mock_db = MagicMock()
        mock_db.scalar.side_effect = [mock_user, mock_auth]

        mock_comm = MagicMock()
        mock_comm.id = comm_id

        with patch.object(CommitteeService, "validate_committee_access", return_value=(mock_auth, mock_comm, None)):
            try:
                await committee_chat_websocket(websocket=mock_ws, committee_id=comm_id, db=mock_db)
            except Exception as e:
                assert "Client disconnect" in str(e)

        mock_ws.accept.assert_awaited_once()
        mock_ws.close.assert_not_awaited()

    asyncio.run(_run())


def test_ws_rejects_reused_ticket_single_use():
    """
    Verifies that a ticket cannot be used twice (single-use fail-closed guarantee).
    """
    async def _run():
        mock_user, mock_auth = _make_mock_user_and_auth()
        comm_id = uuid.uuid4()

        ticket = committee_chat_manager.create_chat_ticket(
            user_id=mock_user.id,
            authority_id=mock_auth.id,
            committee_id=comm_id,
            ttl_seconds=60,
        )

        # First consumption consumes and burns the ticket
        consumed = committee_chat_manager.consume_chat_ticket(ticket, comm_id)
        assert consumed == (mock_user.id, mock_auth.id)

        # Second attempt via WebSocket handshake fails
        mock_ws = AsyncMock()
        mock_ws.query_params = {"ticket": ticket}
        mock_ws.headers = {}
        mock_ws.cookies = {}
        mock_ws.accept = AsyncMock()
        mock_ws.close = AsyncMock()

        mock_db = MagicMock()

        await committee_chat_websocket(websocket=mock_ws, committee_id=comm_id, db=mock_db)

        mock_ws.close.assert_awaited_once_with(code=status.WS_1008_POLICY_VIOLATION)
        mock_ws.accept.assert_not_awaited()

    asyncio.run(_run())


def test_ws_rejects_ticket_for_different_committee():
    """
    Verifies that a ticket issued for Committee A is rejected when attempting to connect to Committee B.
    """
    async def _run():
        mock_user, mock_auth = _make_mock_user_and_auth()
        comm_a = uuid.uuid4()
        comm_b = uuid.uuid4()

        ticket_a = committee_chat_manager.create_chat_ticket(
            user_id=mock_user.id,
            authority_id=mock_auth.id,
            committee_id=comm_a,
            ttl_seconds=60,
        )

        mock_ws = AsyncMock()
        mock_ws.query_params = {"ticket": ticket_a}
        mock_ws.headers = {}
        mock_ws.cookies = {}
        mock_ws.accept = AsyncMock()
        mock_ws.close = AsyncMock()

        mock_db = MagicMock()

        # Connect to comm_b using comm_a's ticket
        await committee_chat_websocket(websocket=mock_ws, committee_id=comm_b, db=mock_db)

        mock_ws.close.assert_awaited_once_with(code=status.WS_1008_POLICY_VIOLATION)
        mock_ws.accept.assert_not_awaited()

    asyncio.run(_run())


def test_ws_accepts_subprotocol_bearer():
    """
    Verifies that Sec-WebSocket-Protocol: bearer.<jwt> is accepted and negotiated.
    """
    async def _run():
        mock_user, mock_auth = _make_mock_user_and_auth()
        token = _make_test_jwt(mock_user.id)
        comm_id = uuid.uuid4()

        mock_ws = AsyncMock()
        mock_ws.query_params = {}
        mock_ws.headers = {"sec-websocket-protocol": f"bearer.{token}"}
        mock_ws.cookies = {}
        mock_ws.accept = AsyncMock()
        mock_ws.close = AsyncMock()
        mock_ws.receive_json.side_effect = Exception("Client disconnect")

        mock_db = MagicMock()
        mock_db.scalar.side_effect = [mock_user, mock_auth]

        mock_comm = MagicMock()
        mock_comm.id = comm_id

        with patch.object(CommitteeService, "validate_committee_access", return_value=(mock_auth, mock_comm, None)):
            try:
                await committee_chat_websocket(websocket=mock_ws, committee_id=comm_id, db=mock_db)
            except Exception as e:
                assert "Client disconnect" in str(e)

        mock_ws.accept.assert_awaited_once_with(subprotocol=f"bearer.{token}")
        mock_ws.close.assert_not_awaited()

    asyncio.run(_run())


def test_ws_accepts_subprotocol_ticket():
    """
    Verifies that Sec-WebSocket-Protocol: vyasa-ticket.<ticket> is accepted and negotiated.
    """
    async def _run():
        mock_user, mock_auth = _make_mock_user_and_auth()
        comm_id = uuid.uuid4()
        ticket = committee_chat_manager.create_chat_ticket(
            user_id=mock_user.id,
            authority_id=mock_auth.id,
            committee_id=comm_id,
            ttl_seconds=60,
        )

        subproto = f"vyasa-ticket.{ticket}"
        mock_ws = AsyncMock()
        mock_ws.query_params = {}
        mock_ws.headers = {"sec-websocket-protocol": subproto}
        mock_ws.cookies = {}
        mock_ws.accept = AsyncMock()
        mock_ws.close = AsyncMock()
        mock_ws.receive_json.side_effect = Exception("Client disconnect")

        mock_db = MagicMock()
        mock_db.scalar.side_effect = [mock_user, mock_auth]

        mock_comm = MagicMock()
        mock_comm.id = comm_id

        with patch.object(CommitteeService, "validate_committee_access", return_value=(mock_auth, mock_comm, None)):
            try:
                await committee_chat_websocket(websocket=mock_ws, committee_id=comm_id, db=mock_db)
            except Exception as e:
                assert "Client disconnect" in str(e)

        mock_ws.accept.assert_awaited_once_with(subprotocol=subproto)
        mock_ws.close.assert_not_awaited()

    asyncio.run(_run())


def test_ws_accepts_cookie_authentication():
    """
    Verifies that authenticating via secure cookie (access_token) is accepted.
    """
    async def _run():
        mock_user, mock_auth = _make_mock_user_and_auth()
        token = _make_test_jwt(mock_user.id)
        comm_id = uuid.uuid4()

        mock_ws = AsyncMock()
        mock_ws.query_params = {}
        mock_ws.headers = {}
        mock_ws.cookies = {"access_token": token}
        mock_ws.accept = AsyncMock()
        mock_ws.close = AsyncMock()
        mock_ws.receive_json.side_effect = Exception("Client disconnect")

        mock_db = MagicMock()
        mock_db.scalar.side_effect = [mock_user, mock_auth]

        mock_comm = MagicMock()
        mock_comm.id = comm_id

        with patch.object(CommitteeService, "validate_committee_access", return_value=(mock_auth, mock_comm, None)):
            try:
                await committee_chat_websocket(websocket=mock_ws, committee_id=comm_id, db=mock_db)
            except Exception as e:
                assert "Client disconnect" in str(e)

        mock_ws.accept.assert_awaited_once()
        mock_ws.close.assert_not_awaited()

    asyncio.run(_run())


def test_ws_unauthenticated_rejected():
    """
    Verifies that requests with no ticket, subprotocol, or cookie are closed with code 1008.
    """
    async def _run():
        comm_id = uuid.uuid4()
        mock_ws = AsyncMock()
        mock_ws.query_params = {}
        mock_ws.headers = {}
        mock_ws.cookies = {}
        mock_ws.accept = AsyncMock()
        mock_ws.close = AsyncMock()

        mock_db = MagicMock()

        await committee_chat_websocket(websocket=mock_ws, committee_id=comm_id, db=mock_db)

        mock_ws.close.assert_awaited_once_with(code=status.WS_1008_POLICY_VIOLATION)
        mock_ws.accept.assert_not_awaited()

    asyncio.run(_run())


def test_ws_unauthorized_member_rejected():
    """
    Verifies that an authenticated authority who is not an active committee member is rejected with 1008.
    """
    async def _run():
        mock_user, mock_auth = _make_mock_user_and_auth()
        token = _make_test_jwt(mock_user.id)
        comm_id = uuid.uuid4()

        mock_ws = AsyncMock()
        mock_ws.query_params = {}
        mock_ws.headers = {"sec-websocket-protocol": f"bearer.{token}"}
        mock_ws.cookies = {}
        mock_ws.accept = AsyncMock()
        mock_ws.close = AsyncMock()

        mock_db = MagicMock()
        mock_db.scalar.side_effect = [mock_user, mock_auth]

        # validate_committee_access raises 403 Forbidden
        with patch.object(
            CommitteeService,
            "validate_committee_access",
            side_effect=HTTPException(status_code=403, detail="Not a committee member"),
        ):
            await committee_chat_websocket(websocket=mock_ws, committee_id=comm_id, db=mock_db)

        mock_ws.close.assert_awaited_once_with(code=status.WS_1008_POLICY_VIOLATION)
        mock_ws.accept.assert_not_awaited()

    asyncio.run(_run())


# -------------------------------------------------------------
# 7. Deterministic Compound Cursor & Cursor Validation Tests
# -------------------------------------------------------------

def test_list_messages_invalid_cursor_rejected_with_404():
    """
    Verifies that supplying a before_id that does not exist or belongs to another
    committee raises HTTP 404 immediately.
    """
    comm_id = uuid.uuid4()
    cursor_id = uuid.uuid4()

    mock_db = MagicMock()
    # Cursor lookup returns None
    mock_db.scalar.return_value = None

    mock_user = MagicMock()
    mock_auth = MagicMock()
    mock_comm = MagicMock()

    with patch.object(CommitteeService, "validate_committee_access", return_value=(mock_auth, mock_comm, None)):
        with pytest.raises(HTTPException) as exc_info:
            CommitteeService.list_messages(
                db=mock_db,
                committee_id=comm_id,
                user=mock_user,
                before_id=cursor_id,
            )
        assert exc_info.value.status_code == 404
        assert f"Cursor message '{cursor_id}' not found in this committee." in str(exc_info.value.detail)


def test_list_messages_compound_cursor_deterministic_ordering():
    """
    Verifies that list_messages returns messages in strictly ascending chronological order
    with tie-breaking by message id when timestamps match.
    """
    comm_id = uuid.uuid4()
    mock_db = MagicMock()

    mock_user = MagicMock()
    mock_auth = MagicMock()
    mock_auth.id = uuid.uuid4()
    mock_auth.name_snapshot = "Dr. Test Authority"
    mock_auth.role.value = "ASSOCIATE_DEAN"
    mock_auth.designation = "Associate Dean"
    mock_comm = MagicMock()

    now = datetime.now(timezone.utc)
    id1 = uuid.UUID("00000000-0000-0000-0000-000000000001")
    id2 = uuid.UUID("00000000-0000-0000-0000-000000000002")

    msg1 = MagicMock()
    msg1.id = id1
    msg1.committee_id = comm_id
    msg1.sender_authority_id = mock_auth.id
    msg1.sender = mock_auth
    msg1.message_text = "Message 1"
    msg1.message_type.value = "MESSAGE"
    msg1.attachment_url = None
    msg1.created_at = now

    msg2 = MagicMock()
    msg2.id = id2
    msg2.committee_id = comm_id
    msg2.sender_authority_id = mock_auth.id
    msg2.sender = mock_auth
    msg2.message_text = "Message 2"
    msg2.message_type.value = "MESSAGE"
    msg2.attachment_url = None
    msg2.created_at = now

    # The DB query with desc(created_at), desc(id) returns [msg2, msg1]
    mock_db.scalars.return_value.all.return_value = [msg2, msg1]

    with patch.object(CommitteeService, "validate_committee_access", return_value=(mock_auth, mock_comm, None)):
        result = CommitteeService.list_messages(
            db=mock_db,
            committee_id=comm_id,
            user=mock_user,
            limit=50,
        )

    # Reversing [msg2, msg1] yields [msg1, msg2] in ascending deterministic order
    assert len(result) == 2
    assert result[0].id == id1
    assert result[1].id == id2
    assert result[0].message_text == "Message 1"
    assert result[1].message_text == "Message 2"


