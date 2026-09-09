"""点亮灯笼（投稿）FSM。"""

from __future__ import annotations

import uuid
from datetime import datetime

from aiogram import Bot, F, Router
from aiogram.filters import Command
from aiogram.fsm.context import FSMContext
from aiogram.fsm.state import State, StatesGroup
from aiogram.types import Message

from bot.config import get_settings
from bot.db import get_db
from bot.keyboards import admin_post_kb, main_menu_kb
from bot.services import ai_service, anti_brush, credit_service, matchmaker_service

router = Router(name="post")


class PostForm(StatesGroup):
    city = State()
    title = State()
    price = State()
    tags = State()
    description = State()
    photos = State()


@router.message(Command("post"))
@router.message(F.text == "✨ 点亮灯笼")
async def start_post(message: Message, state: FSMContext) -> None:
    user = message.from_user
    shadowed, days, reason = await credit_service.is_shadowed(user.id)
    if shadowed:
        await message.answer(
            f"🌑 你处于月影遮蔽中（剩余 {days} 天），暂无法点亮新灯笼。\n"
            f"原因：{reason or '信用过低'}\n请先完成修行恢复。"
        )
        return
    u = await credit_service.ensure_user(user.id)
    ok, msg = anti_brush.can_post(user.id, int(u.get("lanhua_score") or 0))
    if not ok:
        await message.answer(msg)
        return
    await state.set_state(PostForm.city)
    await message.answer("请输入城市（如：台北、深圳、香港）：")


@router.message(PostForm.city)
async def post_city(message: Message, state: FSMContext) -> None:
    await state.update_data(city=message.text.strip()[:32])
    await state.set_state(PostForm.title)
    await message.answer("请输入标题 / 花名（如：元气大学生 · KH）：")


@router.message(PostForm.title)
async def post_title(message: Message, state: FSMContext) -> None:
    await state.update_data(title=message.text.strip()[:64])
    await state.set_state(PostForm.price)
    await message.answer("请输入价位（数字，或文字如 6000 / 面议）：")


@router.message(PostForm.price)
async def post_price(message: Message, state: FSMContext) -> None:
    text = message.text.strip()
    price = None
    digits = "".join(c for c in text if c.isdigit())
    if digits:
        try:
            price = int(digits)
        except ValueError:
            price = None
    await state.update_data(price=price, price_text=text[:32])
    await state.set_state(PostForm.tags)
    await message.answer("请输入标签，空格分隔（如：大学生 KH 真实照）：")


@router.message(PostForm.tags)
async def post_tags(message: Message, state: FSMContext) -> None:
    tags = [t for t in message.text.strip().split() if t][:12]
    await state.update_data(tags=tags)
    await state.set_state(PostForm.description)
    await message.answer("请输入补充说明（请勿留联系方式）：")


@router.message(PostForm.description)
async def post_description(message: Message, state: FSMContext) -> None:
    desc = message.text.strip()[:1000]
    if anti_brush.is_duplicate_text(desc):
        await message.answer("检测到与近期投稿高度重复的内容，请修改后再提交。")
        return
    await state.update_data(description=desc, photos=[])
    await state.set_state(PostForm.photos)
    await message.answer("请上传 1～5 张照片。上传完毕后发送 /done")


@router.message(PostForm.photos, F.photo)
async def post_photo(message: Message, state: FSMContext) -> None:
    data = await state.get_data()
    photos = list(data.get("photos") or [])
    if len(photos) >= 5:
        await message.answer("最多 5 张，请发送 /done 完成。")
        return
    photos.append(message.photo[-1].file_id)
    await state.update_data(photos=photos)
    await message.answer(f"已收 {len(photos)} 张，可继续上传或 /done")


@router.message(PostForm.photos, Command("done"))
async def post_done(message: Message, state: FSMContext, bot: Bot) -> None:
    data = await state.get_data()
    photos = data.get("photos") or []
    if not photos:
        await message.answer("至少需要 1 张照片。")
        return

    auth = await ai_service.estimate_authenticity(
        f"{data.get('title', '')} {data.get('description', '')}"
    )
    lamp = await matchmaker_service.create_lamp_from_post(
        user_id=message.from_user.id,
        city=data.get("city") or "未知",
        title=data.get("title") or "未命名",
        tags=data.get("tags") or [],
        price=data.get("price"),
        price_text=data.get("price_text"),
        description=data.get("description") or "",
        photos=photos,
        authenticity_score=auth,
    )

    db_post_id = str(uuid.uuid4())
    await get_db().posts.insert_one(
        {
            "post_id": db_post_id,
            "user_id": message.from_user.id,
            "lamp_id": lamp["lamp_id"],
            "lamp_data": lamp,
            "status": "pending",
            "created_at": datetime.utcnow(),
        }
    )
    anti_brush.record_post(message.from_user.id)
    await state.clear()
    await message.answer(
        f"✨ 已提交审核。\nAI 预审真实度约 {auth}%\n通过后灯笼会在秘境亮起，你将获得兰花令。",
        reply_markup=main_menu_kb(),
    )

    settings = get_settings()
    for admin_id in settings.admin_id_list:
        try:
            await bot.send_message(
                admin_id,
                f"🆕 新投稿待审\n"
                f"用户：{message.from_user.id}\n"
                f"标题：{lamp.get('title')}\n"
                f"城市：{lamp.get('city')}\n"
                f"真实度预估：{auth}%\n"
                f"lamp_id：{lamp['lamp_id']}\n"
                f"post_id：{db_post_id}",
                reply_markup=admin_post_kb(db_post_id),
            )
            for fid in photos[:3]:
                await bot.send_photo(admin_id, fid)
        except Exception:
            pass


@router.message(PostForm.photos)
async def post_photos_other(message: Message) -> None:
    await message.answer("请发送照片，或 /done 结束上传。")
