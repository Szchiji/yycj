# 上架资料卡片布局评审（未上线）

基线：`origin/main` `ecce4e38fe5805035333b8b68307db0b91eb8d22`（含已合并的 PR61）。  
工作树：`/workspace/yycj-listing-layout`，分支 `feat/listing-card-layout`。  
这是对真实工作台「审核与上架 → 上架资料」列表卡片的局部布局实现，不是新业务功能。

对照用户 20:31（Asia/Shanghai）实机截图：小红卡片上「本次修改状态」被挤在左侧 1–2 字竖排窄栏；主操作行把「修改资料 / 续期… / 重新上架 / 下架」挤在同一行，容易误点。在已上架的小红上点「重新上架」出现「资料已经上架；未重发频道或通知，有效期不变。」——**该提示文案是预期行为，本次未改**；要修的是排版和误点。

## 原因（源码结构，不是改业务）

`.pick-item` 在 ≥860px 时是 `grid-template-columns: 1fr auto`。当卡片多出 `.edit-result`（本次修改状态）后，状态块被放进 `auto` 列；再叠加 `.edit-result p { overflow-wrap: anywhere }`，该列的 min-content 变成约一个字宽，于是正文竖排。当前工作台 `desk.html` 未加载旧的 `admin-ux.js` / `admin-proposal.js`，因此提案里的「主操作 + 更多」整理并未生效，原始五个按钮（含「续期…」和已上架仍可见的「重新上架」）并排挤在一起。

## 本次修改

| 问题 | 实际修改 |
|---|---|
| 状态文字 1–2 字竖排 | `#adminListings` 卡片改为纵向 flex，`.edit-result` 100% 宽、`overflow-wrap: break-word`。有状态的卡片在列表中占满一行。 |
| 续期被写成「续期…」，四键同行易误点 | 主操作行改为「修改资料 / 续期 / 下架（已上架）或重新上架（已下架）/ 更多」；触控高度 44px，窄屏两列折行。 |
| 已上架仍把「重新上架」放在「下架」旁边 | 「重新上架」移入「更多」（删除也在其中）。已下架卡片仍把「重新上架」作为主按钮。`data-list` / `data-fill-proxy` 与既有 admin-list / workspace 确认逻辑不变。 |
| 列表双列把操作行挤换行 | 上架资料列表改为单列，去掉与页标题重复的 pane `h3`。 |

未改：续期 / 下架 / 重新上架 / 删除的 API、已上架再点重新上架的提示原文、有效期规则、频道或老师通知发送、访客端 bundle（仍为 `20261111d`）、Telegram。

已改资源版本：`admin.css`、`admin-ops.js`、`workspace.css` → `20261111e`。`desk.html` / `console.html` / `desk-legacy.html` 已对上。

## 离线评审与截图

```bash
/workspace/venv-yycj/bin/python /workspace/yycj-listing-layout/scripts/export_listing_layout_review.py --output /workspace/yycj-listing-layout-review
```

入口：`/workspace/yycj-listing-layout-review/review-index.html`。HTML 内嵌当前分支真实 CSS/JS，数据为标明的内存示例（小明已上架、小红已上架且带本次修改状态、小青自己下架），CSP 禁止外连。截图由本机 headless Chrome 对上述静态页拍摄，**不是生产环境截图**。

### 截图绝对路径

- `/workspace/yycj-listing-layout-review/mobile-list-top.png` — 390×844，列表顶部（小明主操作行）
- `/workspace/yycj-listing-layout-review/mobile-listings.png` — 390×844，小红状态全文 + 主操作
- `/workspace/yycj-listing-layout-review/mobile-listings-card.png` — 小红卡片裁切
- `/workspace/yycj-listing-layout-review/mobile-more.png` — 小红「更多」展开，内含重新上架 / 删除
- `/workspace/yycj-listing-layout-review/mobile-more-card.png` — 同上卡片裁切
- `/workspace/yycj-listing-layout-review/mobile-relist-alert.png` — 已上架小红经「更多」点重新上架，提示原文未改
- `/workspace/yycj-listing-layout-review/desktop-listings.png` — 1280×1400 工作台列表
- `/workspace/yycj-listing-layout-review/desktop-listings-card.png` — 桌面小红卡片裁切

### 实测（headless Chrome，390 与 1280 视口）

- 小红 `.edit-result` 宽度约占卡片的 94%（手机 340/362 px）和 98%（桌面），状态行宽 314 / 988 px，不再出现 1–2 字窄列。
- 主操作按钮高度均为 44 px；「续期」完整显示，无省略号。
- 已上架小红主行没有「重新上架」（在「更多」里）；已下架小青主行有「重新上架」。
- 提示文案精确为：`资料已经上架；未重发频道或通知，有效期不变。`

详细数字见 `REVIEW-MEASUREMENTS.json`。

## 验证

在 `/workspace/yycj-listing-layout` 中：

- `node --check miniapp/admin-ops.js`
- `node tests/listing_layout_dom.cjs`（新）
- `node tests/edit_ui_dom.cjs`、`tests/relist_ui_dom.cjs`
- `PATH=/workspace/venv-yycj/bin:$PATH node tests/workspace_dom.cjs`（9 个原集成场景）
- `python scripts/build_miniapp.py --check`（访客 bundle 无差异）
- `pytest tests/test_listing_layout_export.py tests/test_renewal_unit.py::test_production_preview_is_unreachable_and_versions_menu_are_consistent`（3 passed）
- `git diff --check`

未跑完整 PostgreSQL 回归（本次只改后台列表展示，不改 API）。未推送、未开 PR、未部署、未发送 Telegram。
