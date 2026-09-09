# 月影车姬 (yycj)

Telegram 修车社区机器人 · 搜索聚合 · 匿名月影会话 · 兰花信用 · Mini App

**Slogan：** 月下寻花，影中见真

---

## 功能一览

| 模块 | 说明 |
|------|------|
| 🔍 搜索灯笼 | 关键词 / 城市 / 价位筛选（无 AI） |
| 匿名会话 | 双方同意后机器人中转，24h 自动结束并结算积分；消息落库，结束后按 `MESSAGE_RETENTION_HOURS` 清理 |
| 点亮灯笼 | 投稿 FSM / Mini App，管理员审核后上架 |
| 月影报告 | 异常报告，审核奖惩 |
| 兰花信用 | 积分公式、等级、日恢复、月影遮蔽；流水审计 |
| 防刷 | 投稿/报告/搜索频率限制、文本重复检测（优先 Redis，无 `REDIS_URL` 时内存回退） |
| 📱 Mini App | `/app` 静态页 + `/api/*`：initData HMAC 登录、搜索、投稿、报告、信用、管理列表 |

---

## 技术栈

- **Bot**：aiogram 3.x
- **接入**：Telegram **Webhook**（FastAPI + Uvicorn）
- **Mini App**：Telegram WebApp + FastAPI `/api` + 静态 `/app`
- **数据库**：**PostgreSQL**（SQLAlchemy 2 async + asyncpg）
- **缓存 / 限流**：**Redis**（可选，`redis` asyncio；未配置则内存回退）
- **调度**：APScheduler（会话过期、消息清理、每日信用 tick）

---

## 目录结构

```
yycj/
├── bot/
│   ├── main.py              # FastAPI webhook + /api + /app 入口 / 本地 polling
│   ├── config.py
│   ├── db.py                # Postgres
│   ├── models.py            # SQLAlchemy ORM（含 SessionMessage）
│   ├── keyboards.py         # 含 WEBAPP_URL 时的 WebApp 按钮
│   ├── middlewares.py
│   ├── api/                 # Mini App / Admin HTTP API
│   ├── handlers/            # start / search / session / post / report / credit / admin
│   └── services/            # credit / session / search / anti_brush / admin_ops
├── miniapp/                 # 静态 Mini App（index.html / app.js / styles.css）
├── scripts/init_db.py
├── requirements.txt
├── .env.example
├── Procfile / railway.toml / nixpacks.toml
└── README.md
```

---

## 环境变量

见 `.env.example`。

| 变量 | 必填 | 说明 |
|------|------|------|
| `BOT_TOKEN` | 是 | BotFather Token（亦用于 WebApp initData HMAC） |
| `DATABASE_URL` | 是 | Postgres 连接串（`postgresql://` 或 `postgresql+asyncpg://`） |
| `ADMIN_IDS` | 强烈建议 | 管理员 Telegram 数字 ID，逗号分隔 |
| `REDIS_URL` | 生产建议 | Redis 连接串；未设则防刷内存回退并打警告 |
| `MESSAGE_RETENTION_HOURS` | 否 | 会话结束后消息保留小时数，默认 `24` |
| `WEBAPP_URL` | Mini App 建议 | 如 `https://<域名>/app`；配置后主菜单出现 WebApp 按钮 |
| `WEBHOOK_HOST` | 生产必填 | 如 `https://xxx.up.railway.app` |
| `WEBHOOK_PATH` | 否 | 默认 `/webhook` |
| `WEBHOOK_SECRET` | 建议 | 与 Telegram secret_token 一致 |
| `PORT` | 否 | 默认 `8080`（Railway 会注入） |

本地不配 `WEBHOOK_HOST` 时自动走 **polling** 便于调试。

管理员可用 `/session_messages <session_id>` 查看落库消息（仅 `ADMIN_IDS`）。

---

## 兰花信用（蓝图对齐摘要）

**档位：** 0–199 暗月 · 200–399 新月 · 400–599 银月 · 600–799 金月 · 800+ 满月。

**遮蔽：** 结算后分数 <200 进入月影遮蔽（至少 3 天）；每日 tick 倒数天数，并对低分用户 `+5` 缓慢恢复（记入流水）。

**会话结算启发式（无 LLM）：**

```
Δ = (8 + 0.18·I + 0.12·D + 0.25·Q + Bonus) × (1 - F) - Penalty
```

- `Q = min(100, 2·消息数 + 5·媒体数)`（启发式质量分；有 LLM 时可替换）
- 好评 Bonus = +12；被举报 Penalty = 40
- **钳制约 `[-15, +28]`**

**高影响 Δ（Bot 审核与流水一致）：**

| 事件 | Δ |
|------|---|
| 投稿审核通过 | +15 |
| 有效报告（举报人） | +10 |
| 有效报告（被举报方） | -30 |
| 无效/恶意报告驳回 | -15 |
| 会话好评 | 计入结算 Bonus |

`CreditHistory` 持续审计所有变动（含管理员 `/api/admin/credit/adjust`）。

---

## Mini App / HTTP API

- 静态：`GET /app/`（`WEBAPP_URL` 建议指向它）
- 健康检查：`GET /health` → `ok`（不变）
- Webhook：`POST /webhook`（不变）

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth` | body `{ "initData": "..." }` → token |
| GET | `/api/me` | 当前用户 |
| GET | `/api/me/credit` | 信用 + 流水 |
| GET | `/api/lamps` | 搜索/列表 `q/city/price_min/price_max` |
| GET | `/api/lamps/{id}` | 详情 |
| POST | `/api/sessions/request` | 发起匿名会话邀请 |
| POST | `/api/posts` | 创建投稿 |
| POST | `/api/reports` | 创建报告 |
| GET | `/api/admin/posts/pending` | 待审投稿（ADMIN_IDS） |
| GET | `/api/admin/reports/pending` | 待审报告 |
| POST | `/api/admin/credit/adjust` | `{user_id, delta, note}` |
| GET | `/api/admin/shadow` | 遮蔽名单 |

除 `/api/auth` 外需 `Authorization: Bearer <token>`。Token 由服务端用 `BOT_TOKEN` 签发短时 HMAC，**不会**把 Bot Token 下发到前端。

Bot 内联审核回调保持可用；Mini App 管理页以列表巡检 + 信用调整为主。

---

## 本地运行

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env：BOT_TOKEN、DATABASE_URL（不要设 WEBHOOK_HOST）
# 可选：REDIS_URL、MESSAGE_RETENTION_HOURS、WEBAPP_URL

python scripts/init_db.py
python -m bot.main
```

本地若要用 Mini App，需 HTTPS 公网隧道（如 Cloudflare Tunnel / ngrok）并把 `WEBAPP_URL` 指到 `https://<隧道>/app`。

---

## Railway 部署（Webhook + Postgres + Redis + Mini App）

1. Railway → New Project → Deploy from GitHub → `Szchiji/yycj`
2. **+ New → Database → PostgreSQL**
3. **+ New → Database → Redis**（推荐；Variables 中引用插件提供的 `REDIS_URL`）
4. 在 bot 服务 Variables 中：
   - `BOT_TOKEN`
   - `DATABASE_URL` = 引用 Postgres 的 `DATABASE_URL`（代码会自动加 `asyncpg`）
   - `REDIS_URL` = 引用 Redis 插件的 `REDIS_URL`
   - `MESSAGE_RETENTION_HOURS` = `24`（可选）
   - `ADMIN_IDS`
   - `WEBHOOK_HOST` = 公网域名，如 `https://<你的服务>.up.railway.app`
   - `WEBAPP_URL` = `https://<你的服务>.up.railway.app/app`
   - `WEBHOOK_SECRET` = 随机长字符串
   - `PORT` 一般由 Railway 自动注入，可不必手写
5. Settings → **Generate Domain**（必须有 HTTPS 公网域名）
6. Start Command：`python -m bot.main`
7. 部署成功后访问 `/health` 应返回 `ok`；`/app/` 应打开 Mini App
8. Logs 出现 `Webhook set -> https://.../webhook` 后，Telegram 发 `/start`
9. BotFather → Bot Settings → Menu Button / 直接用主菜单 WebApp 按钮打开 Mini App

---

## 免责声明

仅用于技术演示与社区信息整理。遵守当地法律，不得用于违法用途。机器人不参与交易撮合。
