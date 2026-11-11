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
6. 只追加地图作用域样式，保留墨绿金、原页面结构；首页117×224卡片规则、三列、分页与后台 PR62/63 均不改。guest bundle JS/CSS 统一 `20261111i`；后台版本仍是原有值。没有新增筛选、地铁数据、定位请求、后台 API、迁移或生产配置变更。

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
新增 DOM：选择/关闭/高亮/照片条件/详情、缩放聚合、相同坐标、600条密集可达、边界包含/非法中心、无位置不造点、文本转义、加载失败/底图失败、加载epoch、显式搜索、成功/错误/城市响应竞争；真实 home loader 与社区/地图脚本另做离线传输集成回归。服务器未改，既有 endpoint 隐私、筛选、城市、限额、状态及 PG 回归仍执行。

未做：真实 OSM 网络/国内可达性、真实 GPS、真实 Telegram 端或生产鉴权 E2E。已有 OSM 提供方和坐标精度没有改变，本地 Leaflet 投影/标记/缩放经实际渲染；若要补提供方验收，需要父代理安排浏览器在**无需登录的本地测试页**开放真实 OSM 瓦片，检查国内网络可达性/版权链接、缩放与瓦片错误；不需要碰生产账户或申请权限。没有为了这项未测验收更换提供方或新增费用。

已知既有边界：区域按公开区中心而非真实资料点匹配；600结果截断会限制该批区域覆盖；后端 home 原有查询异常可能退回200空列表（不是所有服务异常都能在前端区分为失败），本次未改服务端错误契约或到期下架调度。

没有 push、PR、merge、deploy、Telegram 发送、历史回填或 j4。

## 最终本地验证结果
- 完整隔离 PostgreSQL 套件：286 passed（仅 `127.0.0.1:55441/yycj_edit_test`；本轮套件报告1938条警告）。
- `npm --prefix tests run test:ui`：8组全通过；含12个地图交互/密集与环状聚合/隐私/竞争场景、真实 home loader 离线集成、9个既有工作台场景，以及编辑/重上架/卡片布局回归。
- JS语法、bundle `--check`、`git diff --check`：通过。
- 真实 vendored Leaflet + 离线瓦片截图7张，无 pageerror；示例媒体仅在选中且有媒体数据时显示。
