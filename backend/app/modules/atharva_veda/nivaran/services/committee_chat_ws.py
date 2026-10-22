# -*- coding: utf-8 -*-
"""
VYASA / NIVARAN-AI Committee Real-Time Chat WebSocket Manager

Responsibilities:
1. Short-lived single-use ticket management for secure WebSocket authentication (no long-lived bearer tokens in query params).
2. Isolated room management keyed strictly by committee_id.
3. Thread-safe / async tracking of connected member sockets and metadata.
4. Per-connection rate limiting to prevent flood abuse.
5. Resilient broadcasting: slow or dead sockets are pruned without breaking broadcasts to active peers.
6. Empty room cleanup on socket disconnect.

Architectural Note:
This manager maintains state in-memory for single-process deployments. For multi-worker
horizontal scaling across multiple server processes, a message broker like Redis Pub/Sub
would be utilized to relay events across worker nodes.
"""

import asyncio
import logging
import secrets
import time
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set, Tuple
from fastapi import WebSocket

logger = logging.getLogger("vyasa.atharva.chat_ws")


@dataclass
class ConnectionMetadata:
    user_id: uuid.UUID
    authority_id: uuid.UUID
    connected_at: float = field(default_factory=time.time)
    message_timestamps: List[float] = field(default_factory=list)


@dataclass
class ChatTicket:
    user_id: uuid.UUID
    authority_id: uuid.UUID
    committee_id: uuid.UUID
    expires_at: float


class CommitteeChatConnectionManager:
    """
    Manages active WebSocket connections for committee chat rooms.
    Ensures real-time push delivery to all connected committee members with strict isolation.
    """

    def __init__(self):
        # Map committee_id -> {WebSocket: ConnectionMetadata}
        self._rooms: Dict[uuid.UUID, Dict[WebSocket, ConnectionMetadata]] = {}
        # Map ticket_token -> ChatTicket
        self._tickets: Dict[str, ChatTicket] = {}
        self._lock = asyncio.Lock()

    # -------------------------------------------------------------
    # Single-Use Ticket Authentication
    # -------------------------------------------------------------

    def create_chat_ticket(
        self,
        user_id: uuid.UUID,
        authority_id: uuid.UUID,
        committee_id: uuid.UUID,
        ttl_seconds: int = 60,
    ) -> str:
        """
        Generates a secure, short-lived single-use ticket for establishing a WebSocket connection.
        Avoids placing long-lived JWT bearer tokens in the WebSocket handshake query string.
        """
        self._purge_expired_tickets()
        token = secrets.token_urlsafe(32)
        self._tickets[token] = ChatTicket(
            user_id=user_id,
            authority_id=authority_id,
            committee_id=committee_id,
            expires_at=time.time() + ttl_seconds,
        )
        return token

    def consume_chat_ticket(
        self,
        token: str,
        committee_id: uuid.UUID,
    ) -> Optional[Tuple[uuid.UUID, uuid.UUID]]:
        """
        Validates and immediately consumes a ticket token. Single-use only.
        Returns (user_id, authority_id) if valid, or None if invalid or expired.
        """
        self._purge_expired_tickets()
        ticket = self._tickets.pop(token, None)
        if not ticket:
            return None
        if ticket.expires_at < time.time():
            return None
        if ticket.committee_id != committee_id:
            return None
        return ticket.user_id, ticket.authority_id

    def _purge_expired_tickets(self):
        now = time.time()
        expired = [t for t, data in self._tickets.items() if data.expires_at < now]
        for t in expired:
            self._tickets.pop(t, None)

    # -------------------------------------------------------------
    # Room & Connection Lifecycle
    # -------------------------------------------------------------

    async def connect(
        self,
        committee_id: uuid.UUID,
        websocket: WebSocket,
        user_id: uuid.UUID,
        authority_id: uuid.UUID,
        accept: bool = False,
    ):
        """
        Accepts and registers a validated WebSocket connection into the committee room.
        """
        if accept:
            await websocket.accept()
        if committee_id not in self._rooms:
            self._rooms[committee_id] = {}

        self._rooms[committee_id][websocket] = ConnectionMetadata(
            user_id=user_id,
            authority_id=authority_id,
        )
        logger.info(
            f"[ChatWS] User {user_id} (Authority: {authority_id}) connected to room {committee_id}. "
            f"Active room connections: {len(self._rooms[committee_id])}"
        )

    def disconnect(self, committee_id: uuid.UUID, websocket: WebSocket):
        """
        Removes a WebSocket connection and cleans up empty rooms.
        """
        if committee_id in self._rooms:
            self._rooms[committee_id].pop(websocket, None)
            if not self._rooms[committee_id]:
                del self._rooms[committee_id]
                logger.info(f"[ChatWS] Empty room {committee_id} cleaned up.")
            else:
                logger.info(
                    f"[ChatWS] Connection removed from room {committee_id}. "
                    f"Remaining connections: {len(self._rooms[committee_id])}"
                )

    def get_connection_metadata(
        self,
        committee_id: uuid.UUID,
        websocket: WebSocket,
    ) -> Optional[ConnectionMetadata]:
        return self._rooms.get(committee_id, {}).get(websocket)

    def is_rate_limited(
        self,
        committee_id: uuid.UUID,
        websocket: WebSocket,
        max_messages: int = 10,
        window_seconds: float = 3.0,
    ) -> bool:
        """
        Simple sliding window rate limiter per connection:
        Disallows more than max_messages within window_seconds.
        """
        meta = self.get_connection_metadata(committee_id, websocket)
        if not meta:
            return False

        now = time.time()
        meta.message_timestamps = [t for t in meta.message_timestamps if now - t < window_seconds]
        if len(meta.message_timestamps) >= max_messages:
            return True

        meta.message_timestamps.append(now)
        return False

    # -------------------------------------------------------------
    # Delivery & Event Messaging
    # -------------------------------------------------------------

    async def broadcast(self, committee_id: uuid.UUID, payload: dict):
        """
        Broadcasts an event to all active connections in the committee room.
        Tolerates slow or dead consumers without crashing or blocking peers.
        """
        if committee_id not in self._rooms:
            return

        room = self._rooms[committee_id]
        dead_connections: List[WebSocket] = []

        for conn in list(room.keys()):
            try:
                await conn.send_json(payload)
            except Exception as e:
                logger.warning(f"[ChatWS] Send exception to client in room {committee_id}: {e}")
                dead_connections.append(conn)

        for dead in dead_connections:
            self.disconnect(committee_id, dead)

    async def send_error(self, websocket: WebSocket, error_code: str, detail: str):
        """
        Sends an error frame directly to the offending client.
        """
        try:
            await websocket.send_json({
                "type": "error",
                "error_code": error_code,
                "detail": detail,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            })
        except Exception:
            pass

    async def send_ack(self, websocket: WebSocket, message_id: str, client_msg_id: Optional[str] = None):
        """
        Sends a message acknowledgment frame back to the message author.
        """
        try:
            ack_payload = {
                "type": "message_ack",
                "message_id": message_id,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
            if client_msg_id:
                ack_payload["client_msg_id"] = client_msg_id
            await websocket.send_json(ack_payload)
        except Exception:
            pass

    def get_room_member_count(self, committee_id: uuid.UUID) -> int:
        return len(self._rooms.get(committee_id, {}))


# Global singleton instance
committee_chat_manager = CommitteeChatConnectionManager()
