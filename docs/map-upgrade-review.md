# 地图升级完成本地实现 · 待人工验收，未发布

## 工作范围与基线
- 工作树 `/workspace/yycj-map-upgrade`，分支 `feat/map-upgrade`；基线 PR63 `9c67e2ecf23b9424193ca3607de39af1c6292b32`。
- 包含首批地图卡片联动、缩放聚合、显式区域搜索，以及 t174u 追加的城市/行政地区/全部·营业·休息组合筛选；完成真实详情脚本/返回链路与错误竞争回归。
- 被拒绝的 `feat/telegram-native` / `e32a1d3` 没有合入。没有原生 MainButton/SDK 安全区增强、地铁、付费服务、自动定位、历史回填或 j4。
- 首页117×224卡片、三列/分页、墨绿金、六页后台和 PR62/63 行为不改。guest JS/CSS 为 `20261111k`，admin 资产未改。仅本地提交；没有 push、PR、merge、deploy、生产配置/数据写入或 Telegram 发送。

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
**t175u本轮只修行为，不改视觉；以下PNG保留自abc23f0，未重新截图。新版HTML仅静态导出，不表示已打开浏览器验收。**
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

**已有单文件（仅保留审核档案，本轮不再尝试打开）：`file:///workspace/yycj-map-upgrade-review/map-live-file.html`**
- 所用 CSS、Leaflet JS、地图/筛选脚本、示例资料/头像均内嵌，无 localhost、SDK、登录或 API。
- 默认不加载真实瓦片，只有父代理人工点“手动加载真实OSM底图”后按生产相同 URL/配置正常加载当前视野；所需唯一外部资源是按钮后的 OSM 图片瓦片，没有批量巡图/预取。
- 页面详情为明确离线占位（带返回），真实应用详情链路由上述实际脚本集成测试另验。
- 父代理已尝试但工具禁止 file://，此前 localhost 也拒绝连接；两条浏览器路径均未完成，本轮不再重试。没有隧道/公开服务器/安全设置或请求头绕过，也不以 Shell 驱动浏览器。保留文件作档案，不将其视为可用的已验收入口。
- 本子代理未操作在线浏览器/真实瓦片页面；离线 headless 只运行示意页。真实手机 Telegram 触摸/缩放、短屏底栏、600条末项、弱网恢复和 GPS 均**未验收**，不以 mock/HTTP 成功冒充。

## 最终本地测试与发布就绪界线
- 完整隔离 PostgreSQL/单元套件：**289 passed，1996 warnings**，仅 `127.0.0.1:55441/yycj_edit_test`，没有生产DB。新增2个PG集成函数覆盖混合营业/休息/未到点/打烊/未设置、隐藏/下架/待审/到期、跨城/地区验证、缺位置/自定义地区、公开坐标隐私、SQL先排除605条无效数据，以及600候选窗的真实限制。
- **11组DOM全通过**：含地图16场景、真实home loader取消/503/竞争、cache分区与新鲜请求、实际详情/浮层/Back/404/旧gallery/ID三组集成、新增定位/安全17场景，以及既有工作台9场景、编辑/重上架/卡片布局回归。
- bundle重建/`--check`、`git diff --check`通过；**上轮 abc23f0 的19个离线截图/几何场景通过，0 pageerror**；本轮无视觉改动，保留这些截图，未再次启动浏览器。第一次全套在重建前发现2个bundle陈旧断言；重建后完整重跑289项全通过。
- 已验证：本地逻辑、隐私/发布资格、组合筛选/候选上限、实际脚本导航、取消/错误恢复、离线Leaflet几何/底栏可达、历史单次HTTP可达。
- 未验证：真实浏览器OSM渲染/国内可达、Telegram实机/GPS/触摸/真实网络恢复、生产鉴权 E2E。**仍属本地可审核成果，不是全部实机验收完成，更不代表获得上线批准。**


## t175u 有界验收审计：具体缺陷，不追加设计
### 定位确实已存在，但不是新的精确“我的附近”地图产品
- 首页筛选的“用我的位置 / 用当前定位”，以及无中心时用户点“最近”，才调用 `askLocation()`；共享选点器只有“定位到我”显式点击才调用 `locate()`。启动、打开结果地图、拖动/缩放/区域搜索均不申请定位；没有 watchPosition 或自动持续追踪。
- 优先沿用已有 Telegram LocationManager，缺能力用已有浏览器 geolocation；拒绝后不自动切另一来源再次申请权限。不支持/拒绝/超时给已有简短提示，让用户选区作中心或手动拖动；保留原选择，不伪造当前位置。
- 首页 GPS 仅用于会话内筛选：转换后先四舍五入到2位小数，再写 sessionStorage/请求参数；不把原始高精度位置写 localStorage 或公开响应。本轮验证该边界，不添加坐标采集/日志/埋点。
- 必须区别既有“我的·常用位置/上架选点”：用户明确确认保存时，选择点经私有 API 传给服务端，`places.snap` 将新写入位置落约500m网格（`routes_place.py`、`routes_posts.py`）；选择过程中高精度点可能暂存于内存/表单DOM。这不是“位置从来不传服务器”，也不保证历史数据库没有旧值；本轮未读生产库、不回填。公共结果地图仍仅行政区中心；私有点不返回其他访客。
- 第三方底图会获知所查看的大致瓦片区域，不能承诺完全不产生地理推断；没有增加新提供方或精确距离承诺。

### 本轮找到并修复
1. **资料查询8秒超时曾被当主动取消吞掉**：home loader 检查 signal.aborted 直接 return，结果地图可能一直“读取中”、区域搜索仍禁用。现在区分 deadline 与主动取消，deadline进入现有失败/重试路径，释放 busy。
2. **响应头成功、读取JSON时超时/断流会被当200空结果**：旧 json().catch 返回{}。现在地图响应的正文解析错误/无效结构明确失败，正文超时同样可重试，不伪装“暂无”；只限定 map_results，保留非地图旧降级契约。
3. **现有定位回调无上限/迟到回写**：Telegram init/getLocation 无回调曾永久 locBusy；浏览器同步异常也可能锁住。首页与共享选点器补8秒 watchdog、数值/范围检查、一次完成与计时器清理。首页跨城/离开首页/清除/重置/改区中心丢弃旧回调；超时的旧 init 不再申请权限或取消新请求；关闭选点器时中止本地等待并清理计时器，旧init不再申请权限，旧定位不改变新会话视野。原生已发起的一次性权限请求不能由网页撤销，只忽略迟到结果，不调用不存在的取消SDK接口。
4. **Leaflet脚本静默挂起**：既有 loader 仅监听load/error，无终止时间。补8秒截止，失败清除脚本/缓存，用户明确重试可重建；同一在途请求合并、CSS只插一次、旧load回调不覆盖新状态。没有自动重试风暴。

### 新增有价值的自动回归与剩余边界
- `map_home_dom.cjs`：等待响应头与等待正文两种deadline、TypeError断网、截断JSON/错误结构、恢复成功、快速重复重试只提交一次；继续覆盖跨城/过滤器/模式切换/旧成功和旧错误。
- 新 `map_safety_dom.cjs` 17场景：启动零定位申请、显式点击/重复点击、拒绝/不支持/同步异常、timeout解锁、只存2位小数、跨城/清除/隐藏后迟到回调、旧SDK init不能取消新请求、无效坐标不入状态、选点器回调截止/关闭回退、脚本加载挂起后手动恢复/合并/CSS去重。全部仅JSDOM/离线mock，不是Shell浏览器或真实定位。
- 既有 map_results 16场景继续验证底图 tileerror→loading→load恢复、10秒只解锁而不自动重试、重复点击保护、列表回落、销毁清理，以及选择/聚合/旧SDK加载竞争。不能称覆盖所有浏览器/厂商/运营商错误；CSS资源故障、真实权限对话框及第三方网络策略仍需要实机确认。
- 本轮不改CSS/布局；未生成新的PNG。19张旧图代表 abc23f0 的同一视觉布局，HTML/文档更新到当前代码，不能把旧图当本轮新增实机证据。

### 五项能力对照（按本工作流范围归类，不扩大承诺）
| 项目 | 本地实现 | 未做/上线前仍需 |
|---|---|---|
| 标记与资料卡/真实详情联动 | 选中/关闭/真实入口/返回保留状态，脚本回归通过 | 真机点按/照片与返回手感 |
| 密集点与同中心聚合 | 随缩放聚合；同中心列表600条末项可达 | 真机触摸滚动/缩放 |
| 搜索此区域 | 明确点击查询、计数/待应用/空错/取消/重试 | 真正OSM加载及真实弱网；600候选内不是全城空间查询 |
| 城市/行政地区/营业休息组合 | 共用筛选状态、严格公开资格/地区验证、缺定位回落 | 实际城市数据与完整度；不做无数据地铁筛选 |
| 附近入口与位置隐私 | 已有显式GPS/按区/常用位置复用；补超时及迟到保护 | 未新增独立精确附近地图/导航/距离保证；真实权限/GPS未验收 |

### 上线前真实设备验收（目前全部未完成，不得打勾）
- Android/iOS Telegram：首次/已拒绝/未支持/长时间未回调定位，确认不自动申请、可回选区/手动点位；重置/换城/退出后不被旧回调覆盖。
- 真正OSM瓦片、版权/大陆网络、缩放拖动；断网后手动重试/列表回落，恢复后无循环请求。
- 360/390宽和短屏实机：底栏、卡片、同中心最后一项/关闭、键盘与触摸滚动。
- 真正详情进入/返回，换城/组合筛选/快速重复点击与弱网切换下无旧结果覆盖。
- 定位精度仅作粗略筛选；不得把区中心当真实地址或承诺精确距离。本地完成不等于五项实机验收完成，更不等于上线授权。
