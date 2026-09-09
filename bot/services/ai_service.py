"""AI 调用：匹配与鉴真（OpenAI 兼容接口）。无 Key 时走规则降级。"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List

import httpx

from bot.config import get_settings


async def chat_completion(messages: List[Dict[str, str]], temperature: float = 0.4) -> str:
    settings = get_settings()
    if not settings.ai_api_key:
        return ""
    url = settings.ai_api_base.rstrip("/") + "/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.ai_api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": settings.ai_model,
        "messages": messages,
        "temperature": temperature,
    }
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(url, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


def rule_extract_query(text: str) -> Dict[str, Any]:
    city = None
    for c in [
        "台北", "台中", "高雄", "新北", "桃园", "台南", "香港",
        "深圳", "广州", "上海", "北京", "杭州", "成都", "武汉", "南京",
    ]:
        if c in text:
            city = c
            break
    prices = re.findall(r"(\d{3,5})", text)
    price_min = price_max = None
    if prices:
        vals = [int(p) for p in prices]
        price_min = min(vals)
        price_max = max(vals)
    tags = []
    for t in ["大学生", "KH", "可过夜", "温柔", "御姐", "萝莉", "真实照", "学生"]:
        if t.lower() in text.lower() or t in text:
            tags.append(t)
    return {
        "city": city,
        "price_min": price_min,
        "price_max": price_max,
        "tags": tags,
        "raw": text,
    }


async def match_lamps(user_query: str, lamps: List[Dict[str, Any]]) -> Dict[str, Any]:
    extracted = rule_extract_query(user_query)
    scored: List[Dict[str, Any]] = []
    for lamp in lamps:
        score = 40
        if extracted.get("city") and lamp.get("city") == extracted["city"]:
            score += 25
        tags = set(lamp.get("tags") or [])
        for t in extracted.get("tags") or []:
            if t in tags or t in (lamp.get("title") or ""):
                score += 10
        price = lamp.get("price")
        pmin, pmax = extracted.get("price_min"), extracted.get("price_max")
        if price and pmin and pmax:
            if pmin <= price <= pmax:
                score += 15
            elif abs(price - (pmin + pmax) / 2) < 1500:
                score += 8
        score += min(15, int(lamp.get("authenticity_score") or 0) // 7)
        score = min(99, score)
        scored.append({**lamp, "_score": score})

    scored.sort(key=lambda x: x["_score"], reverse=True)
    top = scored[:5]

    settings = get_settings()
    if settings.ai_api_key and top:
        lamps_brief = [
            {
                "lamp_id": x["lamp_id"],
                "title": x.get("title"),
                "city": x.get("city"),
                "tags": x.get("tags"),
                "price": x.get("price"),
                "authenticity_score": x.get("authenticity_score"),
                "rule_score": x["_score"],
            }
            for x in top
        ]
        prompt = (
            f"你是「月影车姬」的月影媒婆，语气温柔诗意。\n"
            f"用户需求：{user_query}\n"
            f"候选灯笼 JSON：{json.dumps(lamps_brief, ensure_ascii=False)}\n\n"
            "请只输出合法 JSON（不要 markdown）：\n"
            "{\n"
            '  "poetic_intro": "不超过两句的诗意开场",\n'
            '  "matches": [{"lamp_id":"...","match_score":0-100,"title":"...","reason":"...","risk_note":"..."}],\n'
            '  "suggestion": "下一步建议"\n'
            "}\n"
            "最多 5 条 matches，只能使用候选里的 lamp_id。"
        )
        try:
            raw = await chat_completion(
                [
                    {"role": "system", "content": "你是月影媒婆，只输出 JSON。"},
                    {"role": "user", "content": prompt},
                ]
            )
            raw = raw.strip()
            if raw.startswith("```"):
                raw = re.sub(r"^```(?:json)?\s*", "", raw)
                raw = re.sub(r"\s*```$", "", raw)
            return json.loads(raw)
        except Exception:
            pass

    matches = []
    for x in top:
        matches.append(
            {
                "lamp_id": x["lamp_id"],
                "match_score": x["_score"],
                "title": x.get("title") or "未命名灯笼",
                "reason": "与你的需求匹配度较高（城市/标签/价位）。",
                "risk_note": f"真实度 {x.get('authenticity_score', 80)}%",
            }
        )
    city = extracted.get("city") or "秘境"
    return {
        "poetic_intro": f"月光洒在兰花秘境，今夜{city}的灯笼格外温柔…",
        "matches": matches,
        "suggestion": "点击灯笼可发起月下私语，或补充更多条件让我再帮你找。",
    }


async def estimate_authenticity(description: str) -> int:
    settings = get_settings()
    base = 75
    if len(description) < 10:
        base -= 15
    if any(w in description for w in ["必火", "稳赚", "加微信", "转账", "中介"]):
        base -= 30
    if settings.ai_api_key:
        try:
            raw = await chat_completion(
                [
                    {
                        "role": "system",
                        "content": "评估这段资源描述的可信度，只输出 0-100 的整数。",
                    },
                    {"role": "user", "content": description[:800]},
                ],
                temperature=0.2,
            )
            m = re.search(r"(\d{1,3})", raw)
            if m:
                return max(0, min(100, int(m.group(1))))
        except Exception:
            pass
    return max(0, min(100, base))
