# One-time CLI utility for creating or updating the admin user record.
import argparse
import os
import sys
from pathlib import Path

import psycopg
from dotenv import load_dotenv


ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.core.security import hash_password  # noqa: E402


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Create or update the Jikkei admin user.",
    )
    parser.add_argument("--email", default="admin@jikkei.dev")
    parser.add_argument("--password", required=True)
    parser.add_argument("--username", default="admin")
    return parser.parse_args()


def main() -> None:
    load_dotenv(ROOT / ".env")

    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise RuntimeError("DATABASE_URL is required in .env")

    # Convert SQLAlchemy URLs to a psycopg-compatible DSN.
    dsn = database_url.replace("postgresql+asyncpg://", "postgresql://", 1)
    dsn = dsn.replace("postgresql+psycopg://", "postgresql://", 1)

    args = parse_args()
    hashed_password = hash_password(args.password)

    query = """
        INSERT INTO users (email, hashed_password, username, role)
        VALUES (%s, %s, %s, 'admin')
        ON CONFLICT (email) DO UPDATE
        SET hashed_password = EXCLUDED.hashed_password,
            role = 'admin',
            updated_at = NOW()
    """

    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            cur.execute(query, (args.email, hashed_password, args.username))

    print(f"Admin user created/updated: {args.email}")


if __name__ == "__main__":
    main()
