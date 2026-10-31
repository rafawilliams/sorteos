import os

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

load_dotenv()


def require_env(name):
    """Return env var `name` or fail with a clear message pointing to .env."""
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Falta la variable {name}. Defínela en .env (ver .env.example).")
    return value


def env_flag(name, default=False):
    """Boolean env var: 1/true/yes/on (case-insensitive) → True; anything else → False."""
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def api_credentials():
    """Credentials for api.loteriapanama.net, read from .env."""
    return {
        "username": require_env("LOTERIA_API_USER"),
        "password": require_env("LOTERIA_API_PASSWORD"),
    }


DATABASE_URL = require_env("DATABASE_URL")

engine = create_engine(DATABASE_URL)
Session = sessionmaker(bind=engine)
Base = declarative_base()
