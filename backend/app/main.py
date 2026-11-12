from __future__ import annotations

import os
import sqlite3
import unicodedata
from contextlib import closing
from pathlib import Path
from typing import Annotated

from fastapi import FastAPI, HTTPException, Query, Response
from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.seed import CLASSES, seed_rows

MAX_NAME = 60

SCHEMA = """
CREATE TABLE IF NOT EXISTS students (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  class_name TEXT NOT NULL,
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 100),
  UNIQUE (name_key, class_name)
);
"""


def name_key(name: str) -> str:
    """Two names are 'the same' when they differ only by case, extra spaces or how an accent is typed."""
    return " ".join(unicodedata.normalize("NFC", name).split()).casefold()


class NewStudent(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    name: str
    class_name: str
    score: Annotated[int, Field(ge=0, le=100)]

    @field_validator("name")
    @classmethod
    def clean_name(cls, value: str) -> str:
        cleaned = " ".join(unicodedata.normalize("NFC", value).split())
        if not cleaned:
            raise ValueError("Name must not be empty.")
        if len(cleaned) > MAX_NAME:
            raise ValueError(f"Name must be at most {MAX_NAME} characters.")
        return cleaned

    @field_validator("class_name")
    @classmethod
    def known_class(cls, value: str) -> str:
        if value not in CLASSES:
            raise ValueError(f"Class must be one of: {', '.join(CLASSES)}.")
        return value


def create_app(db_path: str | Path, *, allow_reset: bool | None = None) -> FastAPI:
    """allow_reset: the /api/test/reset address exists only when this is true (or ENABLE_TEST_RESET=1). Never on in production."""
    if allow_reset is None:
        allow_reset = os.environ.get("ENABLE_TEST_RESET") == "1"
    path = str(db_path)
    app = FastAPI(title="Student Directory")

    def connect() -> sqlite3.Connection:
        conn = sqlite3.connect(path)
        conn.row_factory = sqlite3.Row
        return conn

    def reset() -> None:
        with closing(connect()) as conn:
            conn.executescript("DROP TABLE IF EXISTS students;" + SCHEMA)
            conn.executemany(
                "INSERT INTO students (name, name_key, class_name, score) VALUES (?, ?, ?, ?)",
                [(n, name_key(n), c, s) for n, c, s in seed_rows()],
            )
            conn.commit()

    reset()  # a fresh, known database every time the server starts

    def as_dict(row: sqlite3.Row) -> dict:
        return {"id": row["id"], "name": row["name"], "class_name": row["class_name"], "score": row["score"]}

    @app.get("/api/health")
    def health() -> dict:
        return {"status": "ok"}

    @app.get("/api/classes")
    def classes() -> list[str]:
        return CLASSES

    @app.get("/api/students")
    def list_students(
        q: Annotated[str, Query(max_length=60)] = "",
        class_name: Annotated[str, Query(max_length=10)] = "",
    ) -> list[dict]:
        key = name_key(q)
        sql, args = "SELECT * FROM students WHERE 1=1", []
        if key:
            sql += " AND instr(name_key, ?) > 0"
            args.append(key)
        if class_name:
            sql += " AND class_name = ?"
            args.append(class_name)
        with closing(connect()) as conn:
            return [as_dict(r) for r in conn.execute(sql + " ORDER BY id", args)]

    @app.post("/api/students", status_code=201)
    def add_student(student: NewStudent) -> dict:
        with closing(connect()) as conn:
            try:
                cur = conn.execute(
                    "INSERT INTO students (name, name_key, class_name, score) VALUES (?, ?, ?, ?)",
                    (student.name, name_key(student.name), student.class_name, student.score),
                )
                conn.commit()
            except sqlite3.IntegrityError as error:
                if "UNIQUE" in str(error):
                    raise HTTPException(409, f"{student.name} is already in class {student.class_name}.") from None
                raise
            return as_dict(conn.execute("SELECT * FROM students WHERE id = ?", (cur.lastrowid,)).fetchone())

    @app.delete("/api/students/{student_id}", status_code=204)
    def delete_student(student_id: int) -> Response:
        with closing(connect()) as conn:
            cur = conn.execute("DELETE FROM students WHERE id = ?", (student_id,))
            conn.commit()
            if cur.rowcount == 0:
                raise HTTPException(404, f"Student {student_id} does not exist.")
        return Response(status_code=204)

    if allow_reset:

        @app.post("/api/test/reset", status_code=204)
        def reset_for_tests() -> Response:
            reset()
            return Response(status_code=204)

    return app
