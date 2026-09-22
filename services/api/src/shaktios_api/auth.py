"""Supabase Auth JWT verification for ShaktiOS FastAPI.

The Expo citizen app authenticates with Supabase Auth and sends::

    Authorization: Bearer <supabase_access_token>

with every citizen request. This module validates the Supabase-issued JWT
against the project's JWKS and exposes the verified identity (JWT ``sub``)
to endpoints. Client-supplied user ids are never trusted.

Required server configuration (environment variables):

- ``SUPABASE_URL`` — e.g. ``https://<project-ref>.supabase.co``
- ``SUPABASE_JWT_AUDIENCE`` — optional, defaults to ``authenticated``

The Supabase service-role key must never leave the server and is not used
or needed by this module.
"""

from __future__ import annotations

import os
from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel

bearer_scheme = HTTPBearer(auto_error=False)


class AuthUser(BaseModel):
    """Verified identity extracted from a Supabase access token."""

    id: str  # JWT sub claim — the only trusted user identifier
    email: str | None = None
    role: str | None = None


class AuthError(HTTPException):
    def __init__(self, detail: str = "Invalid or expired credentials") -> None:
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


def supabase_url() -> str:
    return os.getenv("SUPABASE_URL", "").strip().rstrip("/")


def jwt_audience() -> str:
    return os.getenv("SUPABASE_JWT_AUDIENCE", "authenticated").strip() or "authenticated"


def expected_issuer() -> str:
    return f"{supabase_url()}/auth/v1"


@lru_cache(maxsize=1)
def _jwks_client() -> jwt.PyJWKClient:
    base = supabase_url()
    if not base:
        raise AuthError("Server auth is not configured")
    return jwt.PyJWKClient(f"{base}/auth/v1/.well-known/jwks.json")


def verify_token(token: str) -> AuthUser:
    """Validate a Supabase access token and return the verified identity."""
    if not supabase_url():
        raise AuthError("Server auth is not configured")
    try:
        signing_key = _jwks_client().get_signing_key_from_jwt(token).key
    except Exception as error:
        raise AuthError("Invalid or expired credentials") from error
    try:
        claims = jwt.decode(
            token,
            signing_key,
            algorithms=["RS256", "ES256"],
            issuer=expected_issuer(),
            audience=jwt_audience(),
            options={"require": ["exp", "iss", "sub"]},
        )
    except jwt.PyJWTError as error:
        raise AuthError("Invalid or expired credentials") from error
    subject = claims.get("sub")
    if not isinstance(subject, str) or not subject:
        raise AuthError("Invalid or expired credentials")
    email = claims.get("email")
    role = claims.get("role")
    return AuthUser(
        id=subject,
        email=email if isinstance(email, str) else None,
        role=role if isinstance(role, str) else None,
    )


def get_optional_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AuthUser | None:
    """Return the verified user, or None for anonymous requests.

    Machine signal sources (crowd simulator, civic-shield bridge, vision)
    send no token. A present-but-invalid token is rejected with 401 so a
    broken client cannot silently degrade to anonymous.
    """
    if credentials is None or not credentials.credentials:
        return None
    return verify_token(credentials.credentials)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> AuthUser:
    """Require a valid Supabase JWT; reject anonymous/invalid with 401."""
    if credentials is None or not credentials.credentials:
        raise AuthError("Authentication required")
    return verify_token(credentials.credentials)
