from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    decode_access_token,
)


def test_password_hashing_and_verification():
    raw_password = "SecurePassword#2026"
    hashed = hash_password(raw_password)

    assert hashed.startswith("pbkdf2_sha256$")
    assert verify_password(raw_password, hashed) is True
    assert verify_password("WrongPassword", hashed) is False
    assert verify_password(raw_password, "invalid_format_string") is False


def test_jwt_token_creation_and_decoding():
    payload = {"sub": "user-uuid-1234", "role": "administrator"}
    token = create_access_token(payload)

    assert isinstance(token, str)
    decoded = decode_access_token(token)
    assert decoded is not None
    assert decoded["sub"] == "user-uuid-1234"
    assert decoded["role"] == "administrator"
    assert "exp" in decoded


def test_invalid_jwt_decoding():
    assert decode_access_token("not.a.valid.jwt.token") is None
