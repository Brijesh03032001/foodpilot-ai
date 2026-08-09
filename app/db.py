"""Phase 7 — SQLite connection helper.

One place that knows where foodpilot.db lives and hands out connections with
row access by column name. Build/refresh the file with migrate_to_sqlite.py.
"""
import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent.parent / "foodpilot.db"


def connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # rows behave like dicts: row["revenue"]
    return conn
