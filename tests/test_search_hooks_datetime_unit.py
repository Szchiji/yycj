"""Homepage search used to raise UnboundLocalError and be swallowed as an empty list.

home-ui.js always sends service=all (or open/rest). The home route then sets
public_only=True, and search_lamps used datetime.utcnow() while a later
`from datetime import datetime` in the sort=hot branch made datetime a local
for the whole function. search_hooks.search_lamps caught the error at the
_orig_search call and returned [].
"""
from __future__ import annotations

import ast
import asyncio
import inspect
from contextlib import asynccontextmanager
from types import SimpleNamespace

from bot.services import search_hooks, search_service
from bot.services.feed_filters import Filter


def test_search_lamps_does_not_shadow_datetime_with_inner_import():
    tree = ast.parse(inspect.getsource(search_service.search_lamps))
    fn = tree.body[0]
    inner = [
        node
        for node in ast.walk(fn)
        if isinstance(node, ast.ImportFrom)
        and node.module == "datetime"
        and any(alias.name == "datetime" for alias in node.names)
    ]
    assert inner == [], "inner 'from datetime import datetime' shadows the module import and breaks public_only"


class _EmptyResult:
    def scalars(self):
        return self

    def all(self):
        return []


@asynccontextmanager
async def _empty_scope():
    session = SimpleNamespace()

    async def execute(_stmt):
        return _EmptyResult()

    session.execute = execute
    yield session


def _run_orig(**kwargs):
    return asyncio.run(search_hooks._orig_search(**kwargs))


def test_public_only_search_does_not_raise_unboundlocalerror(monkeypatch):
    monkeypatch.setattr(search_service, "session_scope", _empty_scope)
    flt = Filter(service="all", public_only=True)
    # Homepage default sort (new) and the 人气 path both used to crash when public_only is set.
    for sort in ("new", "hot", "reviews"):
        rows = _run_orig(city="深圳", limit=3, sort=sort, flt=flt)
        assert rows == []


def test_hooks_return_items_instead_of_swallowing_public_only_search(monkeypatch):
    items = [{"lamp_id": "lamp-1", "title": "千岛", "media": [], "photos": []}]

    async def fake_search(**kwargs):
        # If the real UnboundLocalError still happened, hooks would catch it and return [].
        return await search_hooks._orig_search(**kwargs)

    # Drive hooks through a successful orig search (module datetime is usable).
    async def ok(**kwargs):
        assert kwargs["flt"].public_only is True
        return list(items)

    monkeypatch.setattr(search_hooks, "_orig_search", ok)
    monkeypatch.setattr(search_hooks, "_with_preview", lambda x: dict(x, preview=True))
    out = asyncio.run(search_hooks.search_lamps(city="深圳", flt=Filter(service="all", public_only=True)))
    assert [x["lamp_id"] for x in out] == ["lamp-1"]
    assert out[0]["preview"] is True


def test_hooks_still_swallow_unexpected_search_errors(monkeypatch):
    async def boom(**kwargs):
        raise RuntimeError("simulated downstream failure")

    monkeypatch.setattr(search_hooks, "_orig_search", boom)
    out = asyncio.run(search_hooks.search_lamps(city="深圳", flt=Filter(service="all", public_only=True)))
    assert out == []
