# 地图首批升级 · 仅本地审核，未发布

基线：PR63 `9c67e2ecf23b9424193ca3607de39af1c6292b32`。新工作树 `/workspace/yycj-map-upgrade`，分支 `feat/map-upgrade`。被拒绝的 `feat/telegram-native` / `e32a1d3` 没有合入；本任务不做原生 Telegram UI、美化安全区或 MainButton。

## 先行审计：现有端到端链路
- `community-ui.js` 首页「地图 / 列表」复用 `home-ui.js` 的城市、关键词、区、价位、标签、营业状态、附近/优惠等现有筛选；请求 `/api/home?map_results=1`，既有登录依赖 `get_current_user_id` 不变。
- 地图引擎为已内置的 Leaflet 1.9.4，由 `place-pick.js` 按需加载。结果地图原来使用 OpenStreetMap 瓦片，缩放上限15；选点器独立使用高德（GCJ-02）/ OSM 回落，本次不改选点器、不混用坐标系，也不增加付费服务或依赖。API 参考：https://leafletjs.com/reference-1.9.4.html 。
- **当前结果地图并没有资料逐条模糊坐标**。`district_groups()` 只返回公开行政区/镇中心及资料ID；`_ser_card()` 白名单不输出 `approx_lat/approx_lng`、用户常用位置或私有 extras。某区无公开中心就没有坐标。比“传原始点到前端再抖动”更保守，本次保持这一边界。
- 搜索后端 `search_service.search_lamps()` SQL 限定 `status=active`、选定城市和现有筛选；map 模式总量仍最多600，超出需缩小既有筛选。休息中的 active 资料按既有政策可见；隐藏/下架资料不由前端恢复。到期由既有 `listing_ops` 到期下架流程改变状态，搜索没有另加独立 expires_at 时间谓词，本次不修改这一业务规则。
- 原来每区一个数量标签，点击后是整段结果列表，没有单资料选择/卡片、动态缩放聚合或视野搜索；每次数据更新都会 fitBounds。详情已经有 `/api/lamps/{id}` + `__yycjRenderDetail` 路径。

## 实际实现范围
1. 新 `map-results.js` 控制器：标记选中后显示紧凑底部网页卡片（不是 Telegram 原生条）。只用已有花名/城市/区/营业文案；仅 `media_count>0` 且有有效公开 cover URL 才放照片，缺图不伪造人像。卡片不盖地图或缩放控件；可关闭，选中点/聚合有高亮；查看详情复用既有路由并回到首页地图。
2. Leaflet 投影像素距离聚合（52px阈值、44px目标），缩放变化时重算数量圆点。点击可分开的聚合最多放大两级；已到上限、同坐标或再缩放也不分开的密集区域，展开可滚动逐条选择器。**不把相同区中心的资料散落成虚构坐标**，600份同点仍可选到最后一份。
3. 拖动/缩放只重画，不请求资料；视野变化后出现「搜索此区域」。明确点击才复用原 `/api/home` 读取当前城市/筛选的最多600份公开结果，然后按**公开区中心是否落在点击时视野内**筛选。不新增后端 bounds 参数、绕过鉴权或扩大查询限额；底图瓦片仍按地图正常加载（`updateWhenIdle`/较小缓冲），与资料查询区分。
4. loading / 空结果 / 失败重试；新查询立即清空旧标记和旧选择。现有 home loader 的序号、模式、城市检查加筛选签名检查，成功和错误都拒绝过时结果。地图引擎异步加载另有 epoch 检查。请求途中再移动不会篡改已提交的视野；完成后仍可点击搜索新的视野。失败重试保持失败请求的区域范围；全城失败重试全城，不误用旧城市的地图视野。
5. 无区中心的资料只放在「不参与区域筛选」折叠列表，绝不补虚构坐标；600上限时明确提示区域搜索只过滤本批结果，不声称完整城区统计。
6. 只追加地图作用域样式，保留墨绿金、原页面结构；首页117×224卡片规则、三列、分页与后台 PR62/63 均不改。guest bundle JS/CSS 统一 `20261111i`；后台版本仍是原有值。没有新增筛选、地铁数据、定位请求、API路径、迁移或生产配置变更；继续完善时仅调整地图查询异常分支，见下。

## 离线审核包
目录 `/workspace/yycj-map-upgrade-review/`，入口 `index.html`。
- `map-overview.html/.png`：390px 初始聚合。
- `map-selected.html/.png`：同区选择后的小红示例卡片（头像为标注示例图，不是真实人物）。
- `map-chooser.html/.png`：同坐标区域的可滚动资料选择器。
- `map-empty.html/.png`：显式搜索后的空区域。
- `map-error.html/.png`：显式搜索失败及重试。
- `map-loading.html/.png`：显式搜索处理中。
- `map-desktop.html/.png`：1280px 正常网页布局。

HTML 使用实际本地 CSS、地图/社区 JS 和真实内置 Leaflet；仅瓦片渲染替换为显式标注的示意网格，数据/请求事件为离线示例。没有 SDK、initData、登录或生产连接。截图脚本只允许该目录 file/data 请求，外部请求全部阻断；**不是线上地图或真实数据截图**。示例媒体由离线适配器替换为内嵌示意图，HTML可离线打开。

重现：
```
/workspace/venv-yycj/bin/python scripts/export_map_review.py --output /workspace/yycj-map-upgrade-review
NODE_PATH=/tmp/listing-shots/node_modules node scripts/screenshot_map_review.cjs /workspace/yycj-map-upgrade-review
NODE_PATH=/workspace/yycj-listing-layout/tests/node_modules PATH=/workspace/venv-yycj/bin:$PATH npm --prefix tests run test:ui
```

## 测试与限制
新增 DOM：选择/关闭/高亮/照片条件/详情、缩放聚合、相同坐标、600条密集可达、边界包含/非法中心、无位置不造点、文本转义、加载失败/底图失败、加载epoch、显式搜索、成功/错误/城市响应竞争；真实 home loader 与社区/地图脚本另做离线传输集成回归。地图查询异常分支现改为503；既有 endpoint 隐私、筛选、城市、限额、状态及 PG 回归仍执行。

未做：真实 OSM 网络/国内可达性、真实 GPS、真实 Telegram 端或生产鉴权 E2E。已有 OSM 提供方和坐标精度没有改变，本地 Leaflet 投影/标记/缩放经实际渲染；若要补提供方验收，需要父代理安排浏览器在**无需登录的本地测试页**开放真实 OSM 瓦片，检查国内网络可达性/版权链接、缩放与瓦片错误；不需要碰生产账户或申请权限。没有为了这项未测验收更换提供方或新增费用。

已知既有边界：区域按公开区中心而非真实资料点匹配；600结果截断会限制该批区域覆盖；列表模式 home 原有查询异常仍保留200空列表；地图模式的查询异常现返回503，不再伪装成空区域。逐项序列化/辅助功能原有降级与到期下架调度未重写。

没有 push、PR、merge、deploy、Telegram 发送、历史回填或 j4。

## t171u 继续完善：底部可达、错误和真实底图检查
- 地图高度随普通浏览器可用视口变化，短屏降至180px，长屏最多350px（桌面440px）。不接入SDK安全区/原生按钮。
- 选择器有独立限高滚动区、底部余量和始终在其外侧的44px关闭按钮；打开选择器或资料卡时，只按实际HTML底栏位置做一次网页滚动，避免底栏盖住操作。不改首页列表/网格。
- 瓦片错误单独显示紧凑「底图暂不可用 / 重试底图 / 查看列表」。不覆盖查询失败或600条限制。手动重试仅redraw瓦片，不查询资料、不自动循环；在途禁重复，10秒只恢复按钮，不自动重试，销毁清理计时器。引擎部分初始化失败清理后可重建。
- 列表回落使用本次结果的可滚动选择器，支持选中、关闭、详情和返回当前结果，不将全城结果误称为同区数据。
- 后端仅4行有界调整：`map_results=1` 的搜索/计算筛选异常返回503和固定安全文案；真实空结果仍200，非地图旧200契约不改。不泄露底层异常、改变鉴权/SQL状态/城市/600上限/坐标输出，无迁移。

### 新截图与实际几何断言
保留原7张并更新，新增瓦片故障、列表回落、600条同中心末项、短屏选中，共15张：
- `map-dense-360x640.png`、`map-dense-390x640.png`、`map-dense-360x568.png`、`map-dense-390x900.png`
- `map-dense-selected-360x640.png`（真实离线DOM点击第600项后）
- `map-selected-360x568.png`
- `map-tile-error.png`、`map-tile-list-360x640.png`（显式注入瓦片错误，不是声称OSM实际失败）

`render-evidence.json` 记录实际Leaflet/DOM布局：600条滚动区确实有overflow；末项可见且elementFromPoint命中；末项底部距固定导航约31px，关闭按钮完整可见。360/390宽、568/640/900高场景均通过，无横向溢出。浏览器自动化仅用于离线示意页，没有打开live页。

### 代表性公开HTTP检查（非浏览器渲染）
2026-11-11 22:17（Asia/Shanghai），每个URL仅一次GET，无凭证、批量抓取或绕缓存：
- `https://web-production-46ed80.up.railway.app/app/vendor/leaflet/leaflet.js?v=20261101c` → HTTP200，`text/javascript`，147552 bytes，Leaflet1.9.4；SHA256与本地内置文件一致。
- 同路径 `leaflet.css?v=20261101c` → HTTP200，`text/css`，14806 bytes。
- `https://tile.openstreetmap.org/12/3344/1784.png` → HTTP200，`image/png`，39768 bytes，256×256；按服务器缓存头正常请求，没有保留/分发瓦片图片。

没有第三方Leaflet CDN，库由应用自托管。结果地图URL仍为官方OSM模板，maxZoom15、正常缓存、updateWhenIdle和小缓冲；版权链接可见。源码未见禁用Referrer配置。政策参考 https://operations.osmfoundation.org/policies/tiles/ 。实际HTTP/缓存/哈希证据见 `network-evidence.json`。这些结果只证明本机一次网络可达，不证明国内网络、Telegram WebView或瓦片实际渲染已验收。

### 给父代理的人工真实底图检查页
`map-live.html` 内嵌字节一致的Leaflet1.9.4与实际本地地图CSS/JS，使用生产相同的OSM URL/参数和公开区中心示例数据。没有SDK、鉴权、定位或生产API。页面默认不加载瓦片，只有人工点「手动加载真实OSM底图」/地图按钮后才请求当前视野；明确Referrer策略，不做预取或自动巡图。

本地服务命令（仅loopback）：
```
/workspace/venv-yycj/bin/python -u -m http.server 18767 --bind 127.0.0.1 --directory /workspace/yycj-map-upgrade-review
```
人工打开 `http://127.0.0.1:18767/map-live.html`，点击加载后检查真实道路/版权、正常缩放/聚合/区域搜索及错误回落。父代理可用其computerUse；本子代理没有操作在线浏览器。仍需真实手机Telegram验证：触摸滚动/缩放、短屏与底栏、同区末项点击/关闭、弱网/断网恢复。GPS未测且本轮不自动申请定位。

## 最终本地验证结果（继续完善后）
- 完整隔离 PostgreSQL 套件：287 passed（仅 `127.0.0.1:55441/yycj_edit_test`；本轮报告1938条警告）。
- 8组DOM全通过；地图16个场景、真实home-loader 503/竞争回归、9个工作台场景以及既有编辑/重新上架/卡片布局回归。
- JS语法、bundle `--check`、`git diff --check` 通过；15个离线截图/几何场景通过，无pageerror。
- 未 push、PR、merge、deploy、修改生产配置、发送Telegram或合入已取消的原生增强。
