# 月影车姬 (yycj)

Telegram 修车社区机器人 · 搜索聚合 · 匿名月影会话 · 兰花信用

**Slogan：** 月下寻花，影中见真

---

## 功能一览

| 模块 | 说明 |
|------|------|
| 🔍 搜索灯笼 | 关键词 / 城市 / 价位筛选（无 AI） |
| 匿名会话 | 双方同意后机器人中转，24h 自动结束并结算积分 |
| 点亮灯笼 | 投稿 FSM，管理员审核后上架 |
| 月影报告 | 异常报告，审核奖惩 |
| 兰花信用 | 积分公式、等级、日恢复、月影遮蔽 |
| 防刷 | 投稿/报告/搜索频率限制、文本重复检测 |

---

## 技术栈

- **Bot**：aiogram 3.x
- **接入**：Telegram **Webhook**（FastAPI + Uvicorn）
- **数据库**：**PostgreSQL**（SQLAlchemy 2 async + asyncpg）
- **调度**：APScheduler（会话过期、每日信用 tick）

---

## 目录结构

```
yycj/
├── bot/
│   ├── main.py              # FastAPI webhook 入口 / 本地 polling
│   ├── config.py
│   ├── db.py                # Postgres
│   ├── models.py            # SQLAlchemy ORM
│   ├── keyboards.py
│   ├── middlewares.py
│   ├── handlers/            # start / search / session / post / report / credit / admin
│   └── services/            # credit / session / search / anti_brush
├── miniapp/index.html
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
| `BOT_TOKEN` | 是 | BotFather Token |
| `DATABASE_URL` | 是 | Postgres 连接串（`postgresql://` 或 `postgresql+asyncpg://`） |
| `ADMIN_IDS` | 强烈建议 | 管理员 Telegram 数字 ID，逗号分隔 |
| `WEBHOOK_HOST` | 生产必填 | 如 `https://xxx.up.railway.app` |
| `WEBHOOK_PATH` | 否 | 默认 `/webhook` |
| `WEBHOOK_SECRET` | 建议 | 与 Telegram secret_token 一致 |
| `PORT` | 否 | 默认 `8080`（Railway 会注入） |

本地不配 `WEBHOOK_HOST` 时自动走 **polling** 便于调试。

---

## 本地运行

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env：BOT_TOKEN、DATABASE_URL（不要设 WEBHOOK_HOST）

python scripts/init_db.py
python -m bot.main
```

---

## Railway 部署（Webhook + Postgres）

1. Railway → New Project → Deploy from GitHub → `Szchiji/yycj`
2. **+ New → Database → PostgreSQL**
3. 在 bot 服务 Variables 中：
   - `BOT_TOKEN`
   - `DATABASE_URL` = 引用 Postgres 的 `DATABASE_URL`（代码会自动加 `asyncpg`）
   - `ADMIN_IDS`
   - `WEBHOOK_HOST` = 公网域名，如 `https://<你的服务>.up.railway.app`
   - `WEBHOOK_SECRET` = 随机长字符串
   - `PORT` 一般由 Railway 自动注入，可不必手写
4. Settings → **Generate Domain**（必须有 HTTPS 公网域名）
5. Start Command：`python -m bot.main`
6. 部署成功后访问 `/health` 应返回 `ok`
7. Logs 出现 `Webhook set -> https://.../webhook` 后，Telegram 发 `/start`

详细步骤见对话中的部署说明。

---

## 免责声明

仅用于技术演示与社区信息整理。遵守当地法律，不得用于违法用途。机器人不参与交易撮合。
