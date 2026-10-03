from unittest.mock import patch

from civic_shield.bridge import build_social_signal, generate_demo_posts


def test_canonical_location_survives_bio_geolocation_and_no_implicit_provider():
    posts = generate_demo_posts(location="registered_zone", count=5)
    for post in posts:
        post["author_bio"] = "Mumbai resident"
    with patch("civic_shield.bridge.analyze_sentiment_and_emotion", side_effect=AssertionError("No provider opt-in")):
        result = build_social_signal(posts, location="registered_zone")
    assert result["location"] == "registered_zone"
    assert result["region"] == "Maharashtra"
    assert result["query_used"] == "registered_zone_crowd_monitoring"
    assert result["sentiment"] == "neutral"


def test_explicit_provider_boundary_is_mockable():
    posts = generate_demo_posts(count=2)
    with patch("civic_shield.bridge.analyze_sentiment_and_emotion", return_value={"sentiment": "negative", "emotion": "fear"}) as provider:
        result = build_social_signal(posts, use_provider=True)
    assert provider.call_count == 2
    assert result["sentiment"] == "negative"


def test_empty_posts_keep_location_without_inventing_volume():
    result = build_social_signal([], location="registered_zone")
    assert result["location"] == "registered_zone"
    assert result["mention_count"] == 0 and result["confidence"] == 0
