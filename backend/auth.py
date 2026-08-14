from functools import wraps

import jwt
from flask import current_app, g, jsonify, request

_jwks_client: jwt.PyJWKClient | None = None


def _get_jwks_client() -> jwt.PyJWKClient:
    # Cached at module scope so we don't re-fetch Supabase's JWKS on every request - PyJWKClient
    # itself also caches the key set in-memory for a while.
    global _jwks_client
    if _jwks_client is None:
        _jwks_client = jwt.PyJWKClient(current_app.config["SUPABASE_JWKS_URL"], cache_keys=True)
    return _jwks_client


def verify_jwt(token: str) -> str:
    """Verifies a Supabase-issued access token and returns the user's id (the `sub` claim).

    This project's Supabase instance signs tokens asymmetrically (ES256), so verification is
    done against Supabase's public JWKS endpoint rather than a shared secret.
    """
    signing_key = _get_jwks_client().get_signing_key_from_jwt(token)
    payload = jwt.decode(
        token,
        signing_key.key,
        algorithms=["ES256", "RS256"],
        audience="authenticated",
    )
    return payload["sub"]


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return jsonify({"error": "missing bearer token"}), 401

        token = auth_header.split(" ", 1)[1]
        try:
            g.user_id = verify_jwt(token)
        except jwt.PyJWTError:
            return jsonify({"error": "invalid or expired token"}), 401

        return fn(*args, **kwargs)

    return wrapper
