"""频道帖链接文案：自定义 / 留空隐藏 / 分隔符用 NBSP，避免 Telegram iOS 把三个链接粘在一起。"""
from bot.services.broadcast import LINK_SEP_HTML, caption_html, link_labels_from_site, links_html, start_url


def test_links_html_default_uses_nbsp_sep():
    lid = "88618ee0-6c79-49d2-8fc3-9259b6a4f5eb"
    out = links_html("MoonBot", lid)
    assert LINK_SEP_HTML in out
    assert out.count("<a ") == 3
    assert "查看详情" in out and "查看评价" in out and "写评价" in out
    # ordinary space-dot-space must NOT be the only separator (iOS collapses it)
    assert " · ".join(["x", "y"]) not in out or LINK_SEP_HTML in out
    assert start_url("MoonBot", lid, "s") in out.replace("&amp;", "&") or "start=s_" in out


def test_links_html_custom_and_empty_hides():
    lid = "88618ee0-6c79-49d2-8fc3-9259b6a4f5eb"
    labels = link_labels_from_site({
        "link_label_detail": "详情",
        "link_label_reviews": "",
        "link_label_write": " 写评 ",
    })
    assert labels == [("s", "详情"), ("w", "写评")]
    out = links_html("MoonBot", lid, labels=labels)
    assert out.count("<a ") == 2 and "查看评价" not in out and "详情" in out
    assert LINK_SEP_HTML in out
    # all hidden
    assert links_html("MoonBot", lid, labels=link_labels_from_site({
        "link_label_detail": "", "link_label_reviews": "", "link_label_write": "",
    })) == ""


def test_caption_keeps_sep_visible():
    lid = "88618ee0-6c79-49d2-8fc3-9259b6a4f5eb"
    cap = caption_html("你好", links_html("B", lid))
    assert LINK_SEP_HTML in cap and "查看详情" in cap


def test_allow_blank_override_cleaner():
    from bot.services.home_feed import clean_override_value, merge_ops
    assert clean_override_value("link_label_detail", "") == ""
    assert clean_override_value("link_label_detail", "详情") == "详情"
    assert clean_override_value("broadcast_channel", "") is None  # empty still clears non-blank keys
    m = merge_ops({"link_label_detail": "", "link_label_reviews": "评", "teacher_show_views": False})
    assert m["link_label_detail"] == "" and m["link_label_reviews"] == "评"
    assert m["teacher_show_views"] is False and m["teacher_show_favs"] is True
