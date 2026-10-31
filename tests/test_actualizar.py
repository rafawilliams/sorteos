"""Tests for the token-protected POST /api/actualizar endpoint."""
import os
import subprocess
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import app as app_module
from app import app, limiter

TOKEN = "s3cret-token"


@pytest.fixture
def client(monkeypatch):
    app.config["TESTING"] = True
    limiter.enabled = False  # the endpoint allows 2/min; tests call it more often
    calls = []

    def fake_run(*args, **kwargs):
        calls.append(args)
        return subprocess.CompletedProcess(args, 0, stdout="ok", stderr="")

    monkeypatch.setattr(app_module.subprocess, "run", fake_run)
    monkeypatch.setattr(app_module.predictor, "update", lambda *a, **k: None)
    monkeypatch.setenv("ACTUALIZAR_TOKEN", TOKEN)
    with app.test_client() as c:
        c.script_calls = calls
        yield c
    limiter.enabled = True


class TestActualizarAuth:
    def test_without_header_is_401(self, client):
        r = client.post("/api/actualizar")
        assert r.status_code == 401
        assert r.get_json()["ok"] is False
        assert client.script_calls == []

    def test_wrong_token_is_401(self, client):
        r = client.post("/api/actualizar", headers={"X-Update-Token": "nope"})
        assert r.status_code == 401
        assert client.script_calls == []

    def test_correct_token_runs_update(self, client):
        r = client.post("/api/actualizar", headers={"X-Update-Token": TOKEN})
        assert r.status_code == 200
        assert r.get_json()["ok"] is True
        assert len(client.script_calls) == 1

    def test_not_configured_is_503(self, client, monkeypatch):
        monkeypatch.delenv("ACTUALIZAR_TOKEN")
        r = client.post("/api/actualizar", headers={"X-Update-Token": TOKEN})
        assert r.status_code == 503
        assert client.script_calls == []

    def test_empty_configured_token_is_503(self, client, monkeypatch):
        monkeypatch.setenv("ACTUALIZAR_TOKEN", "")
        r = client.post("/api/actualizar", headers={"X-Update-Token": ""})
        assert r.status_code == 503
        assert client.script_calls == []


SECRET_TRACE = 'Traceback (most recent call last):\n  File "C:\\srv\\secret\\actualizar_db.py", line 1\nRuntimeError: boom'
HEADERS = {"X-Update-Token": TOKEN}


class TestActualizarErrors:
    def test_script_failure_is_502_without_stderr(self, client, monkeypatch):
        monkeypatch.setattr(app_module.subprocess, "run",
                            lambda *a, **k: subprocess.CompletedProcess(a, 1, stdout="", stderr=SECRET_TRACE))
        retrained = []
        monkeypatch.setattr(app_module.predictor, "update", lambda *a, **k: retrained.append(1))
        r = client.post("/api/actualizar", headers=HEADERS)
        assert r.status_code == 502
        body = r.get_data(as_text=True)
        assert r.get_json()["ok"] is False
        assert "Traceback" not in body and "secret" not in body
        assert retrained == []

    def test_unexpected_exception_is_500_without_message(self, client, monkeypatch):
        def boom(*a, **k):
            raise OSError("C:\srv\secret path exploded")
        monkeypatch.setattr(app_module.subprocess, "run", boom)
        r = client.post("/api/actualizar", headers=HEADERS)
        assert r.status_code == 500
        assert "secret" not in r.get_data(as_text=True)

    def test_retrain_failure_is_logged_and_reported(self, client, monkeypatch, caplog):
        def bad_update(*a, **k):
            raise ValueError("model exploded")
        monkeypatch.setattr(app_module.predictor, "update", bad_update)
        with caplog.at_level("ERROR", logger="sorteos"):
            r = client.post("/api/actualizar", headers=HEADERS)
        assert r.status_code == 200
        data = r.get_json()
        assert data["ok"] is True and data["ml_retrained"] is False
        assert any("model exploded" in (rec.exc_text or "") or "model exploded" in str(rec.exc_info) for rec in caplog.records)

    def test_success_reports_retrained(self, client):
        r = client.post("/api/actualizar", headers=HEADERS)
        assert r.status_code == 200
        assert r.get_json()["ml_retrained"] is True
