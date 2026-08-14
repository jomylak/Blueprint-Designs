import os

from dotenv import load_dotenv

# Loads backend/.env for local dev. In production (Render), real env vars are already set and
# there's no .env file, so this is a no-op there.
load_dotenv()


def _normalize_db_uri(uri: str) -> str:
    # Supabase (and most hosts) hand out a plain "postgresql://" URI, which SQLAlchemy
    # defaults to opening with psycopg2. We use psycopg3 instead (better wheel availability
    # on newer Python versions), which needs the dialect spelled out explicitly.
    if uri.startswith("postgresql://"):
        return uri.replace("postgresql://", "postgresql+psycopg://", 1)
    return uri


class Config:
    SQLALCHEMY_DATABASE_URI = _normalize_db_uri(os.environ["DATABASE_URL"])
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {"pool_pre_ping": True}

    # This Supabase project signs tokens with an asymmetric key (ES256), verified against its
    # public JWKS rather than a shared secret - see auth.py.
    SUPABASE_URL = os.environ["SUPABASE_URL"].rstrip("/")
    SUPABASE_JWKS_URL = f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json"

    ALLOWED_ORIGINS = [
        origin.strip()
        for origin in os.environ.get("ALLOWED_ORIGINS", "http://localhost:8080").split(",")
        if origin.strip()
    ]
