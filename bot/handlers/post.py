"""点亮灯笼（投稿）。"""

from __future__ import annotations

import uuid
from datetime import datetime

from aiogram import Bot, F, Router
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import Message

from bot.config import get_settings
from bot.db import session_scope
from bot.keyboards import admin_post_kb, cancel_kb, main_menu
from bot.models import Post, PostStatus
from bot.services import anti_brush, credit_service, search_service
from sqlalchemy import select

router = Router(name="post")


class PostForm(StatesGroup):
    city = State()
    title = State()
    price = State()
    tags = State()
    description = State()
    photos = State()


@router.message(F.text == "✨ 点亮灯笼")
async def post_start(message: Message, state: FSMContext) -> None:
    user = message.from_user
    if not user:
        return
    u = await credit_service.ensure_user(user.id, username=user.username, full_name=user.full_name)
    if u.get("is_shadowed"):
        await message.answer("你处于月影遮蔽中，暂时无法点亮灯笼。")
        return
    if not anti_brush.check_post_rate(user.id):
        await message.answer("投稿过于频繁，请一小时后再试。")
        return
    await state.set_state(PostForm.city)
    await message.answer("请输入城市（如：台北、深圳、香港）：", reply_markup=cancel_kb())


@router.message(F.text == "取消")
async def cancel_any(message: Message, state: FSMContext) -> None:
    await state.clear()
    await message.answer("已取消。", reply_markup=main_menu())


@router.message(PostForm.city)
async def post_city(message: Message, state: FSMContext) -> None:
    await state.update_data(city=(message.text or "").strip()[:32])
    await state.set_state(PostForm.title)
    await message.answer("请输入标题 / 花名：")


@router.message(PostForm.title)
async def post_title(message: Message, state: FSMContext) -> None:
    await state.update_data(title=(message.text or "").strip()[:64])
    await state.set_state(PostForm.price)
    await message.answer("请输入价位（数字或文字，如 6000 / 面议）：")


@router.message(PostForm.price)
async def post_price(message: Message, state: FSMContext) -> None:
    text = (message.text or "").strip()
    digits = "".join(c for c in text if c.isdigit())
    price = int(digits) if digits else None
    await state.update_data(price=price, price_text=text[:32])
    await state.set_state(PostForm.tags)
    await message.answer("请输入标签，空格分隔（如：大学生 KH 真实照）：")


@router.message(PostForm.tags)
async def post_tags(message: Message, state: FSMContext) -> None:
    tags = [t for t in (message.text or "").replace("，", " ").split() if t][:12]
    await state.update_data(tags=tags)
    await state.set_state(PostForm.description)
    await message.answer("请输入简介描述：")


@router.message(PostForm.description)
async def post_desc(message: Message, state: FSMContext) -> None:
    text = (message.text or "").strip()
    if message.from_user and anti_brush.text_too_similar(message.from_user.id, text):
        await message.answer("内容与近期投稿过于相似，请修改后再试。")
        return
    await state.update_data(description=text[:2000], photos=[])
    await state.set_state(PostForm.photos)
    await message.answer("可发送 1~3 张图片，或发送「跳过」完成投稿：")


@router.message(PostForm.photos, F.photo)
async def post_photo(message: Message, state: FSMContext) -> None:
    data = await state.get_data()
    photos = list(data.get("photos") or [])
    if len(photos) >= 3:
        await message.answer("最多 3 张，请发送「完成」提交。")
        return
    photos.append(message.photo[-1].file_id)
    await state.update_data(photos=photos)
    await message.answer(f"已收 {len(photos)} 张。继续发图，或发「完成」提交。")


@router.message(PostForm.photos, F.text)
async def post_photos_done(message: Message, state: FSMContext, bot: Bot) -> None:
    text = (message.text or "").strip()
    if text not in {"跳过", "完成", "提交"}:
        await message.answer("请发送图片，或发送「跳过」/「完成」。")
        return
    data = await state.get_data()
    await state.clear()
    user = message.from_user
    if not user:
        return

    lamp_data = {
        "city": data.get("city"),
        "title": data.get("title"),
        "tags": data.get("tags") or [],
        "price": data.get("price"),
        "price_text": data.get("price_text"),
        "description": data.get("description") or "",
        "photos": data.get("photos") or [],
    }
    post_id = str(uuid.uuid4())
    async with session_scope() as s:
        s.add(
            Post(
                post_id=post_id,
                user_id=user.id,
                lamp_data=lamp_data,
                status=PostStatus.PENDING.value,
            )
        )

    await message.answer(
        "已提交点亮申请，等待管理员审核。\n通过后会自动上架灯笼。",
        reply_markup=main_menu(),
    )

    settings = get_settings()
    card = (
        f"🆕 新投稿 `{post_id[:8]}`\n"
        f"用户：{user.id} @{user.username or '-'}\n"
        f"城市：{lamp_data['city']}\n"
        f"标题：{lamp_data['title']}\n"
        f"价位：{lamp_data.get('price_text')}\n"
        f"标签：{' '.join(lamp_data.get('tags') or [])}\n"
        f"{lamp_data.get('description', '')[:300]}"
    )
    for admin_id in settings.admin_id_list:
        try:
            await bot.send_message(admin_id, card, reply_markup=admin_post_kb(post_id))
        except Exception:
            pass
