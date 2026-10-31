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


class TestDatabaseUrl:
    def test_missing_raises(self, monkeypatch):
        monkeypatch.delenv("DATABASE_URL", raising=False)
        with pytest.raises(RuntimeError, match="DATABASE_URL"):
            base.require_env("DATABASE_URL")

    def test_no_hardcoded_default(self):
        src = open(base.__file__, encoding="utf-8").read()
        assert "root:root" not in src
