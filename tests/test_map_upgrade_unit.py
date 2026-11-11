"""Map-first-batch contracts. Existing map endpoint tests cover server filter/privacy rules."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_map_only_uses_published_district_group_points():
    src = (ROOT / 'miniapp/map-results.js').read_text()
    assert 'const p={lat:g.lat,lng:g.lng}' in src
    assert 'approx_lat' not in src and 'approx_lng' not in src
    assert 'geolocation' not in src and 'Telegram' not in src
    assert '.slice(0,600)' in src and '不偏移到虚构位置' in src


def test_guest_assets_versioned_without_cancelled_native_integration():
    for name in ['index.html', 'go.html']:
        text = (ROOT / 'miniapp' / name).read_text()
        assert 'app.bundle.js?v=20261111i' in text
        assert 'app.bundle.css?v=20261111i' in text
        assert 'telegram-native' not in text
    manifest = (ROOT / 'scripts/build_miniapp.py').read_text()
    assert manifest.index('"map-results.js"') < manifest.index('"community-ui.js"')
    assert not (ROOT / 'miniapp/telegram-native.js').exists()


def test_no_new_backend_bounds_or_coordinate_exposure():
    home = (ROOT / 'miniapp/home-ui.js').read_text()
    assert 'area:options.mapArea||null' in home
    assert 'requestSig !== filtSig()' in home
    assert 'if(seq!==loadSequence || mapMode!==!!window.__yycjMapMode' in home
    assert 'return !window.__yycjMapMode && !paused' in home
