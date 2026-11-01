"""Tests for configuration loaded from environment (.env)."""
import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import base


class TestApiCredentials:
    def test_reads_from_env(self, monkeypatch):
        monkeypatch.setenv("LOTERIA_API_USER", "u1")
        monkeypatch.setenv("LOTERIA_API_PASSWORD", "p1")
        assert base.api_credentials() == {"username": "u1", "password": "p1"}

    @pytest.mark.parametrize("missing", ["LOTERIA_API_USER", "LOTERIA_API_PASSWORD"])
    def test_missing_raises(self, monkeypatch, missing):
        monkeypatch.setenv("LOTERIA_API_USER", "u1")
        monkeypatch.setenv("LOTERIA_API_PASSWORD", "p1")
        monkeypatch.delenv(missing)
        with pytest.raises(RuntimeError, match=missing):
            base.api_credentials()


class TestEnvFlag:
    @pytest.mark.parametrize("value", ["1", "true", "True", "YES", "on"])
    def test_truthy(self, monkeypatch, value):
        monkeypatch.setenv("FLASK_DEBUG", value)
        assert base.env_flag("FLASK_DEBUG") is True

    @pytest.mark.parametrize("value", ["0", "false", "no", "off", "", "cualquiera"])
    def test_falsy(self, monkeypatch, value):
        monkeypatch.setenv("FLASK_DEBUG", value)
        assert base.env_flag("FLASK_DEBUG") is False

    def test_missing_defaults_false(self, monkeypatch):
        monkeypatch.delenv("FLASK_DEBUG", raising=False)
        assert base.env_flag("FLASK_DEBUG") is False

    def test_app_has_no_hardcoded_debug(self):
        with open(os.path.join(os.path.dirname(base.__file__), "app.py"), encoding="utf-8") as f:
            src = f.read()
        assert "debug=True" not in src


class TestDatabaseUrl:
    def test_missing_raises(self, monkeypatch):
        monkeypatch.delenv("DATABASE_URL", raising=False)
        with pytest.raises(RuntimeError, match="DATABASE_URL"):
            base.require_env("DATABASE_URL")

    def test_no_hardcoded_default(self):
        with open(base.__file__, encoding="utf-8") as f:
            src = f.read()
        assert "root:root" not in src
