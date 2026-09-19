import pytest

from civic_shield.adapter import CivicShieldAdapter


def test_civic_shield_signal_maps_to_social_concern_event() -> None:
    event = CivicShieldAdapter().to_event(
        {
            "region": "Delhi",
            "mention_count": 42,
            "avg_tone": -3.2,
            "sentiment": "negative",
            "emotion": "anger",
            "velocity": 0.84,
            "sample_headline": "Coverage sample",
        }
    )

    assert event == {
        "type": "social_concern",
        "source": "civic_shield",
        "location": "Delhi",
        "confidence": 0.42,
        "payload": {
            "sentiment": "negative",
            "emotion": "anger",
            "velocity": 0.84,
            "mention_count": 42,
            "tone": -3.2,
            "headline": "Coverage sample",
        },
    }


def test_civic_shield_adapter_prefers_explicit_confidence() -> None:
    event = CivicShieldAdapter().to_event(
        {"location_name": "Gate 4", "mention_count": 500, "confidence": 1.4}
    )

    assert event["location"] == "Gate 4"
    assert event["confidence"] == 1.0
    assert event["payload"]["mention_count"] == 500


def test_civic_shield_adapter_requires_location() -> None:
    with pytest.raises(ValueError, match="requires location"):
        CivicShieldAdapter().to_event({"mention_count": 2})
