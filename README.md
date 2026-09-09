# 月影车姬 (yycj)

Telegram 修车社区机器人 · AI 媒婆 · 匿名月影会话 · 兰花信用 · Mini App 演示

**Slogan：** 月下寻花，影中见真

---

## 功能一览

| 模块 | 说明 |
|------|------|
| 月影媒婆 | 自然语言描述需求，规则 + AI 匹配灯笼 |
| 匿名会话 | 双方同意后机器人中转，24h 自动结束并结算积分 |
| 点亮灯笼 | 投稿 FSM，AI 预审真实度，管理员审核 |
| 月影报告 | 异常报告 + 证据，审核奖惩 |
| 兰花信用 | 积分公式、等级、日恢复、月影遮蔽 |
| 防刷 | 投稿/报告/会话频率限制、文本重复检测 |
| Mini App | `miniapp/index.html` 完整 UI 演示（可静态托管） |

---

## 目录结构

```
yycj/
├── bot/
│   ├── main.py              # 入口（polling + 定时任务）
│   ├── config.py            # 环境变量
│   ├── db.py                # MongoDB (motor)
│   ├── models.py            # 文档模型与常量
│   ├── keyboards.py
│   ├── middlewares.py
│   ├── handlers/            # start / matchmaker / session / post / report / credit / admin
│   └── services/            # credit / session / matchmaker / ai / anti_brush
├── miniapp/index.html       # 界面演示
├── scripts/init_mongo.py
├── requirements.txt
├── .env.example
├── Procfile / railway.toml / nixpacks.toml
└── README.md
```

---

## 环境变量

见 `.env.example`。关键项：

| 变量 | 必填 | 说明 |
|------|------|------|
| `BOT_TOKEN` | 是 | BotFather Token |
| `MONGODB_URL` | 是 | MongoDB 连接串 |
| `MONGODB_DB` | 否 | 默认 `yueying` |
| `ADMIN_IDS` | 强烈建议 | 管理员 Telegram 数字 ID，逗号分隔 |
| `AI_API_KEY` | 否 | 不填则媒婆走规则匹配 |
| `AI_API_BASE` | 否 | OpenAI 兼容接口 |
| `AI_MODEL` | 否 | 默认 gpt-4o-mini |
| `WEBAPP_URL` | 否 | Mini App 地址 |

---

## 本地运行

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# 编辑 .env 填入 BOT_TOKEN 与 MONGODB_URL

python scripts/init_mongo.py
python -m bot.main
```

---

## Railway 部署

1. Railway → New Project → Deploy from GitHub → `Szchiji/yycj`
2. 添加 MongoDB 插件（或使用 Atlas）
3. Variables：`BOT_TOKEN`、`MONGODB_URL`、`MONGODB_DB=yueying`、`ADMIN_IDS`
4. Start Command：`python -m bot.main`
5. Logs 出现 `Bot @xxx started` 后，Telegram 发 `/start`

本 bot 使用 long polling，不需要公开 HTTP 端口。

---

## 免责声明

仅用于技术演示与社区信息整理。遵守当地法律，不得用于违法用途。机器人不参与交易撮合。
