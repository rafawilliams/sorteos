"""Integration tests for Flask API endpoints."""
import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import app


@pytest.fixture
def client():
    app.config["TESTING"] = True
    with app.test_client() as c:
        yield c


# ---------------------------------------------------------------------------
# GET /
# ---------------------------------------------------------------------------

class TestIndex:
    def test_returns_html(self, client):
        r = client.get("/")
        assert r.status_code == 200
        assert b"Sorteos" in r.data


# ---------------------------------------------------------------------------
# GET /api/sorteos
# ---------------------------------------------------------------------------

class TestSorteos:
    def test_paginated(self, client):
        r = client.get("/api/sorteos?page=1&per_page=10")
        assert r.status_code == 200
        data = r.get_json()
        assert "data" in data
        assert "total" in data
        assert "page" in data
        assert data["page"] == 1
        assert len(data["data"]) <= 10

    def test_filter_cat(self, client):
        r = client.get("/api/sorteos?page=1&per_page=5&cat=dominical")
        data = r.get_json()
        for s in data["data"]:
            assert s["cat"] == "dominical"

    def test_search(self, client):
        r = client.get("/api/sorteos?page=1&per_page=5&q=0042")
        data = r.get_json()
        assert data["total"] >= 0  # may or may not find results


# ---------------------------------------------------------------------------
# GET /api/simulador
# ---------------------------------------------------------------------------

class TestSimulador:
    def test_valid_number(self, client):
        r = client.get("/api/simulador?numero=0042")
        assert r.status_code == 200
        data = r.get_json()
        assert data["numero"] == "0042"
        assert "exact" in data
        assert "ending" in data
        assert "total_sorteos" in data

    def test_invalid_number(self, client):
        r = client.get("/api/simulador?numero=abcd")
        assert r.status_code == 400

    def test_with_filters(self, client):
        r = client.get("/api/simulador?numero=1234&from=2020-01-01&to=2025-12-31")
        assert r.status_code == 200
        data = r.get_json()
        assert data["numero"] == "1234"


# ---------------------------------------------------------------------------
# GET /api/comparar
# ---------------------------------------------------------------------------

class TestComparar:
    def test_single_number(self, client):
        r = client.get("/api/comparar?numeros=0042")
        assert r.status_code == 200
        data = r.get_json()
        assert len(data["numbers"]) == 1

    def test_multiple_numbers(self, client):
        r = client.get("/api/comparar?numeros=0042,1234,5678")
        assert r.status_code == 200
        data = r.get_json()
        assert len(data["numbers"]) == 3

    def test_no_numbers(self, client):
        r = client.get("/api/comparar?numeros=")
        assert r.status_code == 400

    def test_too_many(self, client):
        r = client.get("/api/comparar?numeros=0001,0002,0003,0004,0005,0006")
        assert r.status_code == 400


# ---------------------------------------------------------------------------
# GET /api/gaps
# ---------------------------------------------------------------------------

class TestGaps:
    def test_returns_data(self, client):
        r = client.get("/api/gaps")
        assert r.status_code == 200
        data = r.get_json()
        assert "total_sorteos" in data
        assert "overdue_numbers" in data
        assert "overdue_endings" in data
        assert "ontime_numbers" in data

    def test_overdue_structure(self, client):
        r = client.get("/api/gaps")
        data = r.get_json()
        for g in data["overdue_numbers"]:
            assert "number" in g
            assert "gap" in g
            assert "avg_gap" in g
            assert "ratio" in g
            assert g["ratio"] > 1
