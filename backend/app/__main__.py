"""python -m app   ->  http://127.0.0.1:8000"""
import os
from pathlib import Path

import uvicorn

from app.main import create_app

db = os.environ.get("STUDENTS_DB", str(Path(__file__).resolve().parent.parent / "students.db"))
uvicorn.run(create_app(db), host="127.0.0.1", port=int(os.environ.get("PORT", "8000")), log_level="warning")
