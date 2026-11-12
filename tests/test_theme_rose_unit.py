"""Rose-glass Mini App theme: tokens, fonts, asset version, no visitor leftover brass, admin untouched."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parent.parent
MINI = ROOT / "miniapp"
V = "20261112e"
BRASS = ("#0F2420", "#D4B26A", "#16302A", "#C9A45C", "#E3C88A", "#1C3D35")
VISITOR_CSS = [
    "styles.css", "home-fix.css", "home-inline.css", "status-badge.css", "hours.css",
    "area-filter.css", "upgrades.css", "place-pick.css", "coupons.css", "me-layout.css",
    "community.css", "entry-announcement.css", "edit-state-ui.css", "edit-history-ui.css",
    "theme-rose.css",
]
ADMIN_KEEP = ["admin.css", "admin-ux.css", "admin-city.css", "workspace.css", "theme-emerald.css"]


def _read(name: str) -> str:
    return (MINI / name).read_text("utf-8")


def test_asset_version_is_unified():
    versions = set()
    for page in ("go.html", "index.html"):
        html = _read(page)
        js = re.search(r"app\.bundle\.js\?v=([A-Za-z0-9]+)", html)
        css = re.search(r"app\.bundle\.css\?v=([A-Za-z0-9]+)", html)
        assert js and css and js.group(1) == css.group(1) == V, page
        versions.add(js.group(1))
    assert versions == {V}


def test_theme_rose_is_last_in_bundle_sources():
    import sys
    sys.path.insert(0, str(ROOT / "scripts"))
    import build_miniapp as bm
    assert bm.CSS[-1] == "theme-rose.css"
    assert "theme-emerald.css" in bm.CSS
    css = bm.build_css()
    assert css.rfind("/* ---- theme-rose.css ---- */") > css.find("/* ---- theme-emerald.css ---- */")
    assert css.rfind("/* ---- theme-rose.css ---- */") > css.find("/* ---- community.css ---- */")
    assert "--rose: #FF2E6B" in css or "--rose:#FF2E6B" in css
    assert "#08050C" in css and "#FFC857" in css and "#9D5BFF" in css and "#64F2C4" in css


def test_font_files_and_faces_are_local():
    fonts = MINI / "fonts"
    for name in (
        "NotoSerifSC-Regular.woff",
        "NotoSerifSC-Bold.woff",
        "NotoSansSC-Regular.woff",
        "NotoSansSC-Bold.woff",
    ):
        path = fonts / name
        assert path.is_file() and path.stat().st_size > 10_000, name
    rose = _read("theme-rose.css")
    assert '@font-face' in rose
    assert 'url("./fonts/NotoSerifSC-Bold.woff")' in rose
    assert 'url("./fonts/NotoSansSC-Regular.woff")' in rose
    assert "fonts.googleapis.com" not in rose
    assert "Noto Serif SC" in rose and "Noto Sans SC" in rose


def test_palette_tokens():
    rose = _read("theme-rose.css")
    for token, value in {
        "--t-bg": "#08050C",
        "--rose": "#FF2E6B",
        "--gold": "#FFC857",
        "--purple": "#9D5BFF",
        "--mint": "#64F2C4",
        "--rest": "#C4B8A8",
        "--t-open-fg": "#08241C",
        "--glass-bar-fallback": "rgba(8, 5, 12, 0.94)",
        "--t-grad-cta": "linear-gradient(135deg, #FF2E6B 0%, #9D5BFF 100%)",
    }.items():
        assert value in rose, token
        # token assignment appears near the value in :root
        assert re.search(rf"{re.escape(token)}:\s*{re.escape(value)}", rose), token


def test_layout_rules_kept():
    rose = _read("theme-rose.css")
    assert "height: 240px" in rose
    assert "height: 168px" in rose
    inline = _read("home-inline.css")
    assert "grid-template-columns:1fr 1fr 1fr" in inline or "grid-template-columns: 1fr 1fr 1fr" in inline
    assert "gap:8px" in inline.replace(" ", "")
    styles = _read("styles.css")
    assert "padding: 8px 12px" in styles  # main inset


def test_visitor_css_has_no_bare_brass_hex():
    """Hardcoded emerald colors may remain only as var() fallbacks, or in unused emerald/admin files."""
    bare = re.compile(r"(?<![:\w])(" + "|".join(re.escape(c) for c in BRASS) + r")(?![0-9A-Fa-f])")
    # Allow inside var(--t-foo, #hex) fallbacks only
    fallback = re.compile(r"var\([^)]*\)")
    for name in VISITOR_CSS:
        raw = _read(name)
        stripped = fallback.sub("", raw)
        # theme-rose may mention old palette in comments explaining the swap
        if name == "theme-rose.css":
            stripped = re.sub(r"/\*.*?\*/", "", stripped, flags=re.S)
        found = set(bare.findall(stripped))
        assert not found, f"{name} still hardcodes {found}"


def test_admin_theme_files_still_emerald():
    admin = _read("admin.css") + _read("workspace.css") + _read("theme-emerald.css")
    assert "#0F2420" in admin or "#16302A" in admin
    assert "#D4B26A" in admin or "#C9A45C" in admin
    # desk pages keep their own admin asset versions, not the visitor bump exclusively
    desk = (MINI / "desk.html").read_text("utf-8")
    assert "workspace.css" in desk
    assert "app.bundle.css" not in desk


def test_telegram_header_follows_token():
    app = _read("app.js")
    kb = _read("keyboard-fix.js")
    assert 'setHeaderColor("#0F2420")' not in app
    assert 'const BG = "#0F2420"' not in kb
    assert "--t-bg" in app and "#08050C" in app
    assert "--t-bg" in kb and "#08050C" in kb
