"""Homepage feed path: service=all => public_only, must return live listings (not an empty swallow)."""
import asyncio
import os
import uuid
from datetime import datetime, timedelta

import pytest

PG = os.environ.get("YYCJ_TEST_PG")
pytestmark = pytest.mark.skipif(not PG, reason="YYCJ_TEST_PG not set")


def test_home_service_all_returns_public_listings(monkeypatch):
    async def run():
        import httpx
        from fastapi import FastAPI
        from bot import db
        from bot.api import routes_core_home as rh
        from bot.api.deps import get_current_user_id
        from bot.db import session_scope
        from bot.models import Lamp, User
        from unittest.mock import AsyncMock
        from bot.services import home_service, places, pin_query, listing_stats, search_hooks
        from bot.services.feed_filters import Filter

        assert PG and "127.0.0.1:55441/" in PG and "yycj_edit_test" in PG
        db._engine = None
        await db.connect_db()
        await db._ensure_columns(db._engine)
        monkeypatch.setattr(places, "get_point", AsyncMock(return_value=None))
        monkeypatch.setattr(pin_query, "list_active_pins", AsyncMock(return_value=[]))
        monkeypatch.setattr(rh, "_home_contacts", AsyncMock(return_value={}))
        monkeypatch.setattr(home_service, "reputation_for_lamp", AsyncMock(return_value={}))
        monkeypatch.setattr(listing_stats, "record_view_soon", lambda *a: None)
        await home_service.update_settings(enabled_cities=["深圳"], ops_config={"coupons_enabled": False})
        lid = str(uuid.uuid4())
        now = datetime.utcnow()
        async with session_scope() as s:
            s.add(User(user_id=99201, role="teacher"))
            s.add(Lamp(
                lamp_id=lid, user_id=99201, title="修后可见", city="深圳", district="南山",
                status="active", expires_at=now + timedelta(days=3), created_at=now,
            ))
        flt = Filter(service="all", public_only=True)
        rows = await search_hooks._orig_search(city="深圳", limit=30, sort="new", flt=flt)
        assert any(x["lamp_id"] == lid for x in rows)
        hooked = await search_hooks.search_lamps(city="深圳", limit=30, sort="new", flt=flt)
        assert any(x["lamp_id"] == lid for x in hooked)
        app = FastAPI()
        app.include_router(rh.router)
        app.dependency_overrides[get_current_user_id] = lambda: 99201
        async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://test") as c:
            r = await c.get("/api/home", params={"city": "深圳", "service": "all"})
            assert r.status_code == 200, r.text
            data = r.json()
            assert any(x.get("lamp_id") == lid for x in data.get("items") or [])
            r2 = await c.get("/api/home", params={"city": "深圳", "service": "all", "sort": "hot"})
            assert r2.status_code == 200, r2.text
            assert any(x.get("lamp_id") == lid for x in r2.json().get("items") or [])
        await db.close_db()
    asyncio.run(run())
