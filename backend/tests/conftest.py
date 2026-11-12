import pytest
from fastapi.testclient import TestClient

from app.main import create_app


@pytest.fixture
def client(tmp_path):
    """A brand-new database for EVERY test, so no test can affect another."""
    return TestClient(create_app(tmp_path / "t.db"))
