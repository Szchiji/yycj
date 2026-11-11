# 地图升级完成本地实现 · 待人工验收，未发布

## 工作范围与基线
- 工作树 `/workspace/yycj-map-upgrade`，分支 `feat/map-upgrade`；基线 PR63 `9c67e2ecf23b9424193ca3607de39af1c6292b32`。
- 包含首批地图卡片联动、缩放聚合、显式区域搜索，以及 t174u 追加的城市/行政地区/全部·营业·休息组合筛选；完成真实详情脚本/返回链路与错误竞争回归。
- 被拒绝的 `feat/telegram-native` / `e32a1d3` 没有合入。没有原生 MainButton/SDK 安全区增强、地铁、付费服务、自动定位、历史回填或 j4。
- 首页117×224卡片、三列/分页、墨绿金、六页后台和 PR62/63 行为不改。guest JS/CSS 为 `20261111j`，admin 资产未改。仅本地提交；没有 push、PR、merge、deploy、生产配置/数据写入或 Telegram 发送。

## 端到端审计及公开数据边界
- 地图使用已有自托管 Leaflet1.9.4，底图 `https://tile.openstreetmap.org/{z}/{x}/{y}.png`，maxZoom15、updateWhenIdle、小缓冲和 OSM 版权链接；没有新 CDN/提供方。选点器的高德/OSM 路径不改。
- 既有 `/api/home` / `/api/lamps/{id}` 和登录依赖保留。新增可选 `service=all|open|rest`，沿用 `city`、`district`、关键词、标签、价格等现有参数；`map_results=1` 仍固定最多600个候选、offset0，不添加空间查询端点。
- **公开位置只是行政区/镇中心，不是资料精确位置或逐条模糊坐标。** `map_groups` 提供 district/count/lamp_ids 及有公开中心时的 lat/lng。公开卡片字段为既有白名单（lamp_id/title/city/district、营业文案/代码、公开媒体等）；不输出 approx_lat/lng、用户常用位置或私有 extras，绝不传精确点到前端抖动。
- 追加响应：`map_filter_options.districts=[{key,label}]`、`services=[all,open,rest]`，`filters.service`、`map_scanned_count`、既有 `map_truncated`。地区选项为本城公开中心集合 + 公开有效资料的有界地区统计（最多40种）+ `__missing__` 未标注地区；不会拿另一城市地区来补点。
- 地图/显式 service 查询先校验开放城市、当前城市地区；未知/跨城地区400，非法 service422，冲突的旧 open=1 与非 open service400。地区无坐标但确有公开资料时仍能筛选，只进入无定位列表；缺地区可选“未标注地区”，不制造坐标。
- active 是发布状态，与营业状态不同。map/service 查询在 SQL **600上限之前**排除非 active、已到期、其他城市/地区，并应用兼容的关键词/标签/价格条件。公开详情同样拒绝隐藏/下架/待审/到期资料404，不依赖到期调度恰好已执行。
- 营业代码复用 `open_shift.shop_status`：open=营业、rest=长期/当日明确休息，wait/closed/unset 不是 rest；它们仅在“全部”出现。休息中的 active 资料仍按原政策公开，详情既有休息禁联系逻辑保留。
- 营业状态按既有 extras/班次计算，仍在最多600候选内处理；未将这些逻辑另写一套 SQL。因此较旧休息资料可能在候选窗外，不能承诺全城完整服务状态/空间覆盖。达到600时 UI 提醒缩小现有筛选；counts 是当前匹配批次，不是全城总数。无 schema 迁移。

## 交互变化
1. **组合筛选**：复用顶部原有城市选择，不另加城市控件；地图增加同一行“地区 / 全部·营业·休息 / 查看结果”，目标≥44px。与原筛选面板和 loader 共用会话状态，不建立第二套过滤器。改动先标待应用、清除旧可选标记并中止旧查询，明确点击才更新；既有面板应用规则保留。
2. **标记→卡片**：选中后显示紧凑网页卡片/高亮；仅有真实公开媒体条件时显示照片，缺图不补假人像。关闭、换选择、切城市/过滤器时状态一致。详情按钮只允许本批真实存在的ID，不接受任意伪造 data 属性。
3. **聚合**：Leaflet 投影52px阈值、44px点击目标，缩放重算；点聚合有界放大。相同中心/放大仍重合时用滚动选择器，600条末项与独立关闭按钮可达，不把同区资料散成虚构点。
4. **搜索此区域**：移动/缩放仅重画，不查资料；明确点击才取本城/当前筛选的最多600候选，再按公开区中心落入提交时视野匹配。无坐标资料不参与区域筛选，另列折叠列表。新移动不会改变已发请求的范围，失败重试保留该次范围。
5. **错误/取消**：地图查询异常503与200真实空结果分开；旧非地图查询的200降级契约不重写。新查询、切城市/列表、离开首页/返回和改过滤器会中止或拒绝旧结果，成功/错误都校验序号、城市和筛选范围。无可定位数据时收起空底图，保留筛选与无定位列表；区域真空仍可移图再搜。
6. **底图错误**：简短“重试底图 / 查看列表”，与资料查询状态分开；只在手点时 redraw，禁重复在途，10秒只恢复按钮、不自动重试；销毁清理。列表回落仍可选资料/详情，不会把全城列表误称同一区。
7. **手机可达**：普通网页可用视口计算地图高度，短屏180px、长屏最高350px、桌面440px。选择器内部滚动，44px关闭不在滚动区内；按真实 HTML 底栏位置一次滚动，使末项/卡片操作不被遮住。不引入原生 Telegram 布局。

## 真实详情/返回与有界修复
- 之前地图详情入口可能留下旧 data-lamp/CTA/gallery，实际 guard 读到旧ID；现在清空旧详情，走既有 `window.openLamp`，仍使用真实 detail-fix/detail-guard/detail-xhs/app 返回处理。
- 进入详情保存当前地图/选择、城市、关键词/筛选签名、网页滚动；关闭既有顶层 viewer 后，下一次网页返回才回首页。范围不变时复用同一地图对象/视野/选中结果，不重查。
- 延迟 gallery/详情响应检查当前ID、显示状态、序号；离开详情取消消费者，迟到响应不能覆盖新详情或隐藏页面。既有共享 detail transport 可能继续完成，但消费者已取消且不能旧画。
- 地图明确查看详情时丢弃该ID短时缓存，避免已下架资料仍命中4秒旧结果；404保留真实不可用状态及返回。
- 原 home memo key 漏掉 service/map_results/coupon/place 且混用鉴权分区；补齐 key，map_results 查询走新鲜可取消 transport，避免列表缓存伪装成地图结果。resilience 不重试调用方已主动取消的请求。
- DOM 集成使用**实际 app/home/community/map/detail/cache/guard/网页返回脚本**与离线 mock transport；没有伪造 Telegram initData 或生产鉴权。既有相册浮层以测试DOM插入，只验证现有 Back 先关浮层，不声称照片点击本来就会打开它。

## 审核文件与截图（19张）
目录 `/workspace/yycj-map-upgrade-review/`，入口 `index.html`，说明 `LAYOUT-REVIEW.md`。
- `map-overview.html/.png`：初始聚合、原城市与紧凑组合筛选。
- `map-filters.html/.png`、`map-filters-360x640.png`：深圳 / 南山 / 休息组合，3份示例结果。
- `map-filters-pending.html/.png`：草稿筛选，无自动资料请求。
- `map-filter-empty.html/.png`：已应用组合与关键词为空结果。
- `map-selected.html/.png`、`map-chooser.html/.png`：选中示例卡片/同中心选择器。
- `map-empty.html/.png`、`map-error.html/.png`、`map-loading.html/.png`：区域空/503模拟/处理中。
- `map-desktop.html/.png`：1280px。
- `map-dense-360x640.png`、`map-dense-390x640.png`、`map-dense-360x568.png`、`map-dense-390x900.png`：600条同中心可滚动列表。
- `map-dense-selected-360x640.png`、`map-selected-360x568.png`：最后一项/短屏卡片。
- `map-tile-error.html/.png`、`map-tile-list-360x640.png`：显式注入底图故障与列表回落。

截图内嵌实际 CSS/home-ui/map/community/Leaflet，使用明确标注的离线示意网格与 fixture 数据；媒体为内嵌示例图，不是真实人物。没有 SDK/initData/凭证/生产 API。截图脚本仅允许本审核目录 file/data，阻断外部请求；**不是线上地图或真实 Telegram chrome 截图**。几何断言见 `render-evidence.json`：360/390宽、568/640/900高均无横向溢出，600条末项/关闭实际 hit-test 通过（末项距底栏约31px）；过滤器≥44px。

重现离线导出/截图：
```
/workspace/venv-yycj/bin/python scripts/export_map_review.py --output /workspace/yycj-map-upgrade-review
/workspace/venv-yycj/bin/python scripts/export_map_review.py --output /workspace/yycj-map-upgrade-review --live-tiles
NODE_PATH=/tmp/listing-shots/node_modules node scripts/screenshot_map_review.cjs /workspace/yycj-map-upgrade-review
```

## 真实底图：历史网络证据与人工文件入口
2026-11-11 22:17（Asia/Shanghai），每URL一次正常公开GET，无凭证/批量/绕缓存：
- 生产自托管 `/app/vendor/leaflet/leaflet.js?v=20261101c`：200 text/javascript，147552 bytes，1.9.4，SHA256与本地一致。
- 对应 leaflet.css：200 text/css，14806 bytes。
- `https://tile.openstreetmap.org/12/3344/1784.png`：200 image/png，39768 bytes，256×256。未保留/分发真实瓦片图片。
证据保留 `network-evidence.json`，本轮**没有再GET瓦片**。政策 https://operations.osmfoundation.org/policies/tiles/ 。这些只证明本机当时单次 HTTP 可达，不能证明浏览器/国内网络/Telegram实际渲染。

父代理之前打开 loopback 失败；本轮不重试、不新开服务器、不公开绑定、不建隧道、不改网络/浏览器安全。

**新的单文件入口：`file:///workspace/yycj-map-upgrade-review/map-live-file.html`**
- 所用 CSS、Leaflet JS、地图/筛选脚本、示例资料/头像均内嵌，无 localhost、SDK、登录或 API。
- 默认不加载真实瓦片，只有父代理人工点“手动加载真实OSM底图”后按生产相同 URL/配置正常加载当前视野；所需唯一外部资源是按钮后的 OSM 图片瓦片，没有批量巡图/预取。
- 页面详情为明确离线占位（带返回），真实应用详情链路由上述实际脚本集成测试另验。
- 请父代理自行决定能否用 computerUse 打开此文件，人工检查真实道路、版权、缩放、选择、区域搜索与错误回落。file 来源可能因浏览器安全或正常 Referrer/OSM 政策受限；若不允许则停止，不改变安全设置或伪装请求头绕过。
- 本子代理未操作在线浏览器/真实瓦片页面；离线 headless 只运行示意页。真实手机 Telegram 触摸/缩放、短屏底栏、600条末项、弱网恢复和 GPS 均**未验收**，不以 mock/HTTP 成功冒充。

## 最终本地测试与发布就绪界线
- 完整隔离 PostgreSQL/单元套件：**289 passed，2005 warnings**，仅 `127.0.0.1:55441/yycj_edit_test`，没有生产DB。新增2个PG集成函数覆盖混合营业/休息/未到点/打烊/未设置、隐藏/下架/待审/到期、跨城/地区验证、缺位置/自定义地区、公开坐标隐私、SQL先排除605条无效数据，以及600候选窗的真实限制。
- **10组DOM全通过**：含地图16场景、真实home loader取消/503/竞争、cache分区与新鲜请求、实际详情/浮层/Back/404/旧gallery/ID三组集成，以及既有工作台9场景、编辑/重上架/卡片布局回归。
- bundle重建/`--check`、`git diff --check`通过；**19个离线截图/几何场景通过，0 pageerror**。第一次全套在重建前发现2个bundle陈旧断言；重建后完整重跑289项全通过。
- 已验证：本地逻辑、隐私/发布资格、组合筛选/候选上限、实际脚本导航、取消/错误恢复、离线Leaflet几何/底栏可达、历史单次HTTP可达。
- 未验证：真实浏览器OSM渲染/国内可达、Telegram实机/GPS/触摸/真实网络恢复、生产鉴权 E2E。**仍属本地可审核成果，不是全部实机验收完成，更不代表获得上线批准。**
