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
