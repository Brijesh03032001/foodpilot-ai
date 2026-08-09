"""Phase 7 — migrate orders/sales JSON into a real SQLite database.

Why this exists: answering "revenue last week", "top item by orders", "avg
order value per truck" over JSON means hand-writing an accumulation loop every
time. In SQL those are one GROUP BY / SUM each. This is the "aggregation pain"
the spec (Section 5.6) says finally forces SQLite.

Run:  ./cuisine/bin/python migrate_to_sqlite.py   (safe to re-run; it rebuilds)
"""
import json
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA_DIR = ROOT / "data"
DB_PATH = ROOT / "foodpilot.db"


def _load(name: str) -> list[dict]:
    return json.loads((DATA_DIR / f"{name}.json").read_text())


def build_database(db_path: Path = DB_PATH) -> None:
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # Rebuild from scratch every run so the migration is idempotent.
    cur.executescript(
        """
        DROP TABLE IF EXISTS order_items;
        DROP TABLE IF EXISTS orders;
        DROP TABLE IF EXISTS menu_items;
        DROP TABLE IF EXISTS trucks;

        CREATE TABLE trucks (
            id   TEXT PRIMARY KEY,
            name TEXT
        );
        CREATE TABLE menu_items (
            id       TEXT PRIMARY KEY,
            name     TEXT,
            truck_id TEXT
        );
        CREATE TABLE orders (
            id             TEXT PRIMARY KEY,
            customer_id    TEXT,
            truck_id       TEXT,
            status         TEXT,
            created_at     TEXT,   -- ISO 8601 string; SQLite date() reads it
            subtotal       REAL,
            tax            REAL,
            tip            REAL,
            total          REAL,
            payment_status TEXT
        );
        CREATE TABLE order_items (
            id            TEXT PRIMARY KEY,
            order_id      TEXT,
            menu_item_id  TEXT,
            quantity      INTEGER,
            unit_price    REAL,
            line_total    REAL
        );

        CREATE INDEX idx_orders_truck_date ON orders(truck_id, created_at);
        CREATE INDEX idx_items_order        ON order_items(order_id);
        CREATE INDEX idx_items_menu         ON order_items(menu_item_id);
        """
    )

    trucks = _load("trucks")
    cur.executemany(
        "INSERT INTO trucks (id, name) VALUES (?, ?)",
        [(t["id"], t.get("name")) for t in trucks],
    )

    items = _load("menu_items")
    cur.executemany(
        "INSERT INTO menu_items (id, name, truck_id) VALUES (?, ?, ?)",
        [(i["id"], i.get("name"), i.get("truck_id")) for i in items],
    )

    orders = _load("orders")
    cur.executemany(
        """INSERT INTO orders
           (id, customer_id, truck_id, status, created_at,
            subtotal, tax, tip, total, payment_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
        [
            (o["id"], o.get("customer_id"), o.get("truck_id"), o.get("status"),
             o.get("created_at"), o.get("subtotal"), o.get("tax"), o.get("tip"),
             o.get("total"), o.get("payment_status"))
            for o in orders
        ],
    )

    order_items = _load("order_items")
    cur.executemany(
        """INSERT INTO order_items
           (id, order_id, menu_item_id, quantity, unit_price, line_total)
           VALUES (?, ?, ?, ?, ?, ?)""",
        [
            (oi["id"], oi.get("order_id"), oi.get("menu_item_id"),
             oi.get("quantity"), oi.get("unit_price"), oi.get("line_total"))
            for oi in order_items
        ],
    )

    conn.commit()

    counts = {
        t: cur.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
        for t in ("trucks", "menu_items", "orders", "order_items")
    }
    conn.close()
    print(f"Built {db_path.name}:", counts)


if __name__ == "__main__":
    build_database()
