from bot.services.home_feed import (
    merge_ops,
    normalize_announcement_items,
    pack_announcement,
    resolve_home_announcement,
)


def test_normalize_prefers_items_and_falls_back_to_legacy_text():
    assert normalize_announcement_items("旧公告", ["第一条", "  ", "第二条"]) == ["第一条", "第二条"]
    assert normalize_announcement_items("  欢迎使用月影车姬  ", None) == ["欢迎使用月影车姬"]
    assert normalize_announcement_items("", []) == []
    assert normalize_announcement_items(None, ["", "  "]) == []
    # Do not invent a second item by splitting historical single-line text.
    assert normalize_announcement_items("一行；里有分号和逗号，仍算一条", None) == ["一行；里有分号和逗号，仍算一条"]


def test_pack_and_resolve_city_override_and_hidden_when_off():
    packed = pack_announcement("忽略", ["全站一", "全站二"], True)
    assert packed == {"text": "全站一", "items": ["全站一", "全站二"], "enabled": True}
    settings = {
        "announcement_enabled": True,
        "announcement_text": "全站旧字段",
        "announcement_items": ["全站一", "全站二"],
        "city_announcements": {"深圳": {"text": "本城一", "items": ["本城一", "本城二"], "enabled": True}},
    }
    sz = resolve_home_announcement(settings, "深圳")
    assert sz == {"text": "本城一", "items": ["本城一", "本城二"], "enabled": True}
    # Empty / disabled city overlay falls back to global (legacy: cannot hide global this way).
    settings["city_announcements"]["深圳"]["enabled"] = False
    gz = resolve_home_announcement(settings, "广州")
    assert gz == {"text": "全站一", "items": ["全站一", "全站二"], "enabled": True}
    settings["announcement_enabled"] = False
    assert resolve_home_announcement(settings, "广州") is None
    settings["announcement_enabled"] = True
    settings["announcement_items"] = []
    settings["announcement_text"] = ""
    assert resolve_home_announcement(settings, "杭州") is None


def test_legacy_text_only_settings_still_resolve():
    settings = {"announcement_enabled": True, "announcement_text": "欢迎使用月影车姬", "announcement_items": []}
    assert resolve_home_announcement(settings, "深圳") == {
        "text": "欢迎使用月影车姬",
        "items": ["欢迎使用月影车姬"],
        "enabled": True,
    }
    # merge_ops city rows keep items derived from a single text, never drop the old key.
    out = merge_ops({"city_announcements": {"广州": {"text": "广州公告", "enabled": True}}})
    assert out["city_announcements"]["广州"] == {
        "text": "广州公告",
        "items": ["广州公告"],
        "enabled": True,
    }
