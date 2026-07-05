"""Tests for app.routing.language."""

from app.routing.language import LanguageRouter, determine_direction, KOREAN_PATTERN


def test_english_routes_to_en_to_ko():
    router = LanguageRouter()
    assert router.route("en", "Hello, I need to push the deadline") == "en_to_ko"


def test_korean_routes_to_ko_to_en():
    router = LanguageRouter()
    assert router.route("ko", "마감일을 미뤄야 합니다") == "ko_to_en"


def test_code_switch_prioritizes_ko_to_en():
    router = LanguageRouter()
    # Detected as English, but contains Korean chars → ko_to_en
    assert router.route("en", "I need to API를 호출해야 해요") == "ko_to_en"


def test_unknown_language_uses_sticky():
    router = LanguageRouter(last_direction="en_to_ko")
    assert router.route("ja", "こんにちは") == "en_to_ko"


def test_no_korean_in_short_utterance():
    router = LanguageRouter()
    assert router.route("en", "yes") == "en_to_ko"


# ---------- extra confidence tests ----------

def test_korean_pattern_matches_hangul_syllable():
    assert KOREAN_PATTERN.search("안녕") is not None


def test_korean_pattern_matches_jamo():
    assert KOREAN_PATTERN.search("\u1100\u1161") is not None  # ㄱ + ㅏ


def test_korean_pattern_does_not_match_ascii():
    assert KOREAN_PATTERN.search("Hello API") is None


def test_determine_direction_convenience():
    assert determine_direction("ko", "테스트") == "ko_to_en"
    assert determine_direction("en", "test") == "en_to_ko"
    # Sticky via kwarg
    assert determine_direction("fr", "bonjour", last_direction="ko_to_en") == "ko_to_en"


def test_sticky_updates_after_known_language():
    router = LanguageRouter()
    router.route("ko", "테스트")
    # last_direction now ko_to_en; unknown language should stick
    assert router.route("ja", "こんにちは") == "ko_to_en"


def test_sticky_updates_after_code_switch():
    router = LanguageRouter()
    router.route("en", "API를 호출")
    assert router.route("ja", "こんにちは") == "ko_to_en"


def test_unknown_language_no_sticky_defaults_to_en_to_ko():
    router = LanguageRouter()  # last_direction=None
    assert router.route("fr", "bonjour") == "en_to_ko"