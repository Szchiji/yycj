# 猎游机器人 (lieyou)

Telegram 群组管理机器人 · 支持签到、排班、成员管理、自动回复等。

## 功能概览

- 菜单与群管
- 签到打卡
- 成员资料管理
- 自动回复
- 排班/日程

## 环境变量

| 变量名 | 必填 | 说明 |
|--------|------|------|
| `TELEGRAM_TOKEN` | 是 | BotFather 获取的 Bot Token |
| `DATABASE_URL` | 是 | PostgreSQL 连接串（Railway 插件会自动注入） |
| `ADMIN_IDS` | 否 | 管理员 Telegram ID，逗号分隔，如 `123456,789012` |

## 本地运行

```bash
pip install -r requirements.txt
export TELEGRAM_TOKEN=你的Token
export DATABASE_URL=postgresql://user:pass@localhost:5432/lieyou
python init_db.py   # 首次初始化表结构
python bot.py
```

## Railway 部署

详见下方「Railway 部署步骤」。

## 初始化数据库

首次部署后在 Railway 的 Shell 中执行：

```bash
python init_db.py
```

或使用仓库内的 `schema.sql` / `database.sql` 在 Postgres 插件里手动执行。
