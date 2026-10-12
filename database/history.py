# database/history.py
import sqlite3
import os
import json
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATABASE_DIR = os.path.join(BASE_DIR, "database")
DATABASE_PATH = os.path.join(DATABASE_DIR, "history.db")


def get_connection():
    os.makedirs(DATABASE_DIR, exist_ok=True)
    connection = sqlite3.connect(DATABASE_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_database():
    connection = get_connection()
    try:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS research_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                question TEXT NOT NULL,
                answer TEXT NOT NULL,
                search_query TEXT,
                sources TEXT,
                created_at TEXT NOT NULL
            )
        """)

        columns = {
            row["name"]
            for row in connection.execute("PRAGMA table_info(research_history)").fetchall()
        }
        if "conversation_id" not in columns:
            connection.execute("ALTER TABLE research_history ADD COLUMN conversation_id TEXT")
        if "language" not in columns:
            connection.execute("ALTER TABLE research_history ADD COLUMN language TEXT DEFAULT 'en'")

        # Keep all existing records: older standalone items become their own conversations.
        connection.execute("""
            UPDATE research_history
            SET conversation_id = CAST(id AS TEXT)
            WHERE conversation_id IS NULL OR conversation_id = ''
        """)
        connection.execute("""
            CREATE INDEX IF NOT EXISTS idx_research_conversation
            ON research_history(conversation_id, id)
        """)
        connection.commit()
    finally:
        connection.close()


def save_research(question, answer, search_query, sources, conversation_id=None, language="en"):
    connection = get_connection()
    try:
        cursor = connection.execute("""
            INSERT INTO research_history
                (question, answer, search_query, sources, created_at, conversation_id, language)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            question,
            answer,
            search_query,
            json.dumps(sources or [], ensure_ascii=False),
            datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            str(conversation_id or "default"),
            language or "en",
        ))
        connection.commit()
        return cursor.lastrowid
    finally:
        connection.close()


def get_history(limit=50):
    """Return one sidebar entry per conversation, newest activity first."""
    connection = get_connection()
    try:
        rows = connection.execute("""
            SELECT conversation_id,
                   MIN(id) AS first_id,
                   MAX(id) AS last_id,
                   MIN(question) AS first_question,
                   MAX(created_at) AS last_created_at,
                   COUNT(*) AS turn_count
            FROM research_history
            GROUP BY conversation_id
            ORDER BY MAX(id) DESC
            LIMIT ?
        """, (limit,)).fetchall()

        history = []
        for row in rows:
            # The earliest row's question is the conversation title.
            first = connection.execute("""
                SELECT question, created_at FROM research_history
                WHERE conversation_id = ? ORDER BY id ASC LIMIT 1
            """, (row["conversation_id"],)).fetchone()
            history.append({
                "id": row["conversation_id"],
                "conversation_id": row["conversation_id"],
                "question": first["question"] if first else row["first_question"],
                "created_at": row["last_created_at"],
                "turn_count": row["turn_count"],
            })
        return history
    finally:
        connection.close()


def get_conversation(conversation_id):
    connection = get_connection()
    try:
        rows = connection.execute("""
            SELECT id, question, answer, search_query, sources, created_at,
                   conversation_id, language
            FROM research_history
            WHERE conversation_id = ?
            ORDER BY id ASC
        """, (str(conversation_id),)).fetchall()
        return [dict(row) for row in rows]
    finally:
        connection.close()


def get_research(research_id):
    connection = get_connection()
    try:
        row = connection.execute("""
            SELECT id, question, answer, search_query, sources, created_at,
                   conversation_id, language
            FROM research_history WHERE id = ?
        """, (research_id,)).fetchone()
        return dict(row) if row else None
    finally:
        connection.close()


def delete_research(research_id):
    connection = get_connection()
    try:
        connection.execute("DELETE FROM research_history WHERE id = ?", (research_id,))
        connection.commit()
    finally:
        connection.close()


def delete_conversation_turns_from(conversation_id, turn_id):
    connection = get_connection()
    try:
        connection.execute("""
            DELETE FROM research_history
            WHERE conversation_id = ? AND id >= ?
        """, (str(conversation_id), int(turn_id)))
        connection.commit()
    finally:
        connection.close()


def delete_all_history():
    connection = get_connection()
    try:
        connection.execute("DELETE FROM research_history")
        connection.commit()
    finally:
        connection.close()
