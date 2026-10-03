"""No real seeds/reset/HTTP: verify script plans, refusal guards and contracts."""
import importlib.util
import sys
from pathlib import Path
from unittest.mock import patch

import pytest

ROOT = Path(__file__).resolve().parents[3]


def load(path, name):
    spec = importlib.util.spec_from_file_location(name, ROOT / path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


@pytest.fixture
def scripts(monkeypatch):
    monkeypatch.syspath_prepend(str(ROOT / "scripts"))
    return load("scripts/seed_kolkata_durga_puja.py", "release_kolkata")


def test_legacy_seed_fixture_preserves_input_and_labels_machine_sources(scripts):
    from shaktios_api.models import Event
    entries = scripts.load_events()
    citizens = 0
    for entry in entries:
        before = dict(entry)
        if entry["type"] == "citizen_report":
            citizens += 1
            with pytest.raises(ValueError, match="cannot be submitted"):
                scripts.to_api_event(entry)
        else:
            _, payload = scripts.to_api_event(entry)
            event = Event(**payload)
            assert event.source.startswith("seed_")
            assert event.payload["is_seeded"] is True
        assert entry == before
    assert citizens > 0


def test_default_kolkata_dry_run_never_creates_http_client(scripts, capsys):
    with patch.object(scripts.httpx, "Client", side_effect=AssertionError("No network")):
        assert scripts.seed_events(limit=1) == 1
    assert "Skipping" in capsys.readouterr().out


def test_seed_main_default_is_offline(monkeypatch):
    monkeypatch.syspath_prepend(str(ROOT / "scripts"))
    seed = load("scripts/seed.py", "release_seed")
    monkeypatch.setattr(sys, "argv", ["seed.py", "--count", "1"])
    with patch.object(seed.httpx, "Client", side_effect=AssertionError("No network")):
        seed.main()


@pytest.mark.parametrize("environment,url", [("production", "sqlite:///:memory:"), ("development", "sqlite:///:memory:"), ("test", "postgresql://unused:unused@localhost/test")])
def test_reset_refuses_non_disposable_configuration(monkeypatch, environment, url):
    reset = load("scripts/reset_demo.py", "release_reset")
    monkeypatch.setenv("APP_ENV", environment)
    monkeypatch.setenv("DATABASE_URL", url)
    monkeypatch.setattr(sys, "argv", ["reset_demo.py", "--yes"])
    assert reset.main() == 2  # Returns before creating an engine or querying data.


def test_demo_writer_guard_rejects_production_without_network(monkeypatch):
    safety = load("scripts/demo_safety.py", "release_safety")
    monkeypatch.setenv("APP_ENV", "production")
    with pytest.raises(RuntimeError, match="production"):
        safety.machine_headers("https://api.example.com")


def test_supabase_config_and_migrations_are_statically_reviewable():
    import tomllib
    settings = tomllib.loads((ROOT / "supabase/config.toml").read_text())
    assert settings["project_id"] == "shaktios" and "project" not in settings
    migration = (ROOT / "supabase/migrations/20260924000000_release_access_hardening.sql").read_text()
    assert migration.count("AS RESTRICTIVE") == 5
    assert "FROM anon, authenticated" in migration
    assert "DROP TABLE" not in migration and "DELETE FROM" not in migration
    assert "UPDATE storage.buckets SET public = false" in migration
    # This is NOT a PostgreSQL execution/RLS test. Apply only after staging review.
