import pytest
from fastapi.testclient import TestClient

from app.main import create_app, name_key
from app.seed import CLASSES, seed_rows


def add(client, **kw):
    body = {"name": "New Person", "class_name": "6A", "score": 50} | kw
    return client.post("/api/students", json=body)


# ---------- list ----------
def test_lists_the_30_seeded_students_in_id_order(client):
    rows = client.get("/api/students").json()
    assert len(rows) == 30
    assert [r["id"] for r in rows] == list(range(1, 31))
    assert rows[0] == {"id": 1, "name": "Aarav Reddy", "class_name": "6A", "score": 40}


def test_every_row_has_exactly_four_fields(client):
    assert all(set(r) == {"id", "name", "class_name", "score"} for r in client.get("/api/students").json())


def test_search_matches_part_of_a_name_ignoring_case(client):
    names = [r["name"] for r in client.get("/api/students", params={"q": "REDDY"}).json()]
    assert names == ["Aarav Reddy", "Charan Reddy"]


def test_search_ignores_extra_spaces(client):
    assert len(client.get("/api/students", params={"q": "  aarav    reddy "}).json()) == 1


def test_search_with_no_match_is_an_empty_list_not_an_error(client):
    r = client.get("/api/students", params={"q": "zzzz"})
    assert r.status_code == 200 and r.json() == []


def test_class_filter(client):
    rows = client.get("/api/students", params={"class_name": "7A"}).json()
    assert rows and all(r["class_name"] == "7A" for r in rows)
    assert len(rows) == sum(1 for _, c, _ in seed_rows() if c == "7A")


def test_search_and_class_together(client):
    rows = client.get("/api/students", params={"q": "reddy", "class_name": "6A"}).json()
    assert [r["name"] for r in rows] == ["Aarav Reddy"]


def test_unknown_class_filter_is_an_empty_list(client):
    assert client.get("/api/students", params={"class_name": "99Z"}).json() == []


def test_a_percent_sign_in_search_is_just_text(client):
    assert client.get("/api/students", params={"q": "%"}).json() == []


def test_a_quote_in_search_is_just_text(client):
    r = client.get("/api/students", params={"q": "' OR 1=1 --"})
    assert r.status_code == 200 and r.json() == []


def test_too_long_search_is_refused(client):
    assert client.get("/api/students", params={"q": "a" * 61}).status_code == 422


def test_classes(client):
    assert client.get("/api/classes").json() == CLASSES


# ---------- create ----------
def test_create_returns_201_and_the_new_row(client):
    r = add(client, name="Zara Khan", class_name="8A", score=77)
    assert r.status_code == 201
    assert r.json() == {"id": 31, "name": "Zara Khan", "class_name": "8A", "score": 77}


def test_created_student_shows_up_in_the_list(client):
    add(client, name="Zara Khan")
    assert "Zara Khan" in [r["name"] for r in client.get("/api/students").json()]


def test_name_is_cleaned(client):
    assert add(client, name="   Zara    Khan  ").json()["name"] == "Zara Khan"


@pytest.mark.parametrize("name", ["", "   ", "\t\n"])
def test_empty_name_refused(client, name):
    assert add(client, name=name).status_code == 422


def test_name_length_limit_is_inclusive(client):
    assert add(client, name="a" * 60).status_code == 201
    assert add(client, name="b" * 61).status_code == 422


@pytest.mark.parametrize("score", [-1, 101, 1000])
def test_score_outside_0_to_100_refused(client, score):
    assert add(client, score=score).status_code == 422


@pytest.mark.parametrize("score", [0, 100])
def test_score_edges_accepted(client, score):
    assert add(client, name=f"Edge {score}", score=score).status_code == 201


@pytest.mark.parametrize("score", ["50", 50.5, None, True])
def test_score_must_be_a_whole_number(client, score):
    assert add(client, score=score).status_code == 422


def test_unknown_class_refused_with_the_allowed_list(client):
    r = add(client, class_name="99Z")
    assert r.status_code == 422 and "6A" in r.text


def test_extra_fields_refused(client):
    assert client.post("/api/students", json={"name": "A", "class_name": "6A", "score": 1, "admin": True}).status_code == 422


def test_missing_fields_refused(client):
    assert client.post("/api/students", json={"name": "A"}).status_code == 422


def test_non_json_body_refused(client):
    assert client.post("/api/students", content="hello", headers={"content-type": "application/json"}).status_code == 422


def test_duplicate_in_the_same_class_is_409_with_a_readable_message(client):
    r = add(client, name="Aarav Reddy", class_name="6A")
    assert r.status_code == 409 and r.json()["detail"] == "Aarav Reddy is already in class 6A."


def test_duplicate_ignores_case_spaces_and_accent_form(client):
    assert add(client, name="  AARAV   reddy ", class_name="6A").status_code == 409
    assert add(client, name="Renée", class_name="6B").status_code == 201  # e + accent
    assert add(client, name="Renée", class_name="6B").status_code == 409  # one-character e-acute


def test_same_name_in_another_class_is_allowed(client):
    assert add(client, name="Aarav Reddy", class_name="8A").status_code == 201


def test_a_refused_student_is_not_stored(client):
    add(client, name="Aarav Reddy", class_name="6A")
    add(client, score=500)
    assert len(client.get("/api/students").json()) == 30


# ---------- delete ----------
def test_delete_returns_204_and_removes_it(client):
    assert client.delete("/api/students/1").status_code == 204
    assert 1 not in [r["id"] for r in client.get("/api/students").json()]


def test_delete_twice_second_is_404(client):
    client.delete("/api/students/1")
    r = client.delete("/api/students/1")
    assert r.status_code == 404 and r.json()["detail"] == "Student 1 does not exist."


def test_delete_with_a_non_number_is_422(client):
    assert client.delete("/api/students/abc").status_code == 422


def test_ids_are_not_reused_after_a_delete(client):
    client.delete("/api/students/30")
    assert add(client).json()["id"] == 31


# ---------- the test-only reset address ----------
def test_reset_address_does_not_exist_by_default(client):
    assert client.post("/api/test/reset").status_code in (404, 405)


def test_reset_address_exists_only_when_switched_on(tmp_path):
    c = TestClient(create_app(tmp_path / "r.db", allow_reset=True))
    c.delete("/api/students/1")
    assert c.post("/api/test/reset").status_code == 204
    assert len(c.get("/api/students").json()) == 30


def test_reset_switched_on_by_the_environment(tmp_path, monkeypatch):
    monkeypatch.setenv("ENABLE_TEST_RESET", "1")
    assert TestClient(create_app(tmp_path / "e.db")).post("/api/test/reset").status_code == 204


def test_reset_off_when_the_environment_says_anything_else(tmp_path, monkeypatch):
    monkeypatch.setenv("ENABLE_TEST_RESET", "yes")
    assert TestClient(create_app(tmp_path / "e.db")).post("/api/test/reset").status_code in (404, 405)


# ---------- small pieces ----------
def test_health(client):
    assert client.get("/api/health").json() == {"status": "ok"}


def test_unknown_address_404(client):
    assert client.get("/api/nope").status_code == 404


def test_name_key_joins_the_two_ways_of_typing_an_accent():
    assert name_key("Rene\u0301e") == name_key("Ren\u00e9e")  # e + accent  ==  one-character e-acute


def test_stored_names_use_the_one_character_accent_form(client):
    assert add(client, name="Rene\u0301e", class_name="8A").json()["name"] == "Ren\u00e9e"


def test_name_key_rules():
    assert name_key("  Straße  ") == name_key("STRASSE")
    assert name_key("A  B") == "a b"


def test_server_start_gives_a_fresh_database(tmp_path):
    a = TestClient(create_app(tmp_path / "s.db"))
    a.delete("/api/students/1")
    b = TestClient(create_app(tmp_path / "s.db"))  # same file, "restart"
    assert len(b.get("/api/students").json()) == 30
