// 后台城市分区：顶部城市切换（全部 + 每个城市，带待审数），每条记录显示城市标签，
// 切换城市时列表接口加 ?city=（服务器过滤，运营只拿到自己负责的城市）。
(() => {
  if (window.__yycjAdminCity) return;
  window.__yycjAdminCity = true;
  const KEY = "yycj_admin_city";
  const token = () => localStorage.getItem("yycj_token") || "";
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const S = { sel: localStorage.getItem(KEY) || "", sum: null, scope: null, isSuper: false, ops: null };
  const reg = { post: {}, review: {}, report: {}, lamp: {}, pin: {}, user: {} };
  const palette = {};
  const tagClass = (c) => {
    if (!c || c === "未知") return "city-tag unknown";
    if (!(c in palette)) palette[c] = Object.keys(palette).length % 6;
    return "city-tag" + (palette[c] ? " c" + palette[c] : "");
  };
  const tagHtml = (c) => `<span class="${tagClass(c)}">${esc(c || "未知")}</span>`;

  // ---- fetch wrapper: add ?city= to admin list reads, learn row → city from responses
  const LIST = /^\/api\/admin\/(posts\/pending|reviews\/pending|reports\/pending|listings|homepage|shadow|users)$/;
  const rawFetch = window.fetch.bind(window);
  function learn(path, data) {
    if (!data || typeof data !== "object") return;
    const items = data.items || [];
    if (path.endsWith("/posts/pending")) items.forEach((x) => { reg.post[x.post_id] = x.city || (x.lamp_data || {}).city || "未知"; });
    else if (path.endsWith("/reviews/pending")) items.forEach((x) => { reg.review[x.review_id] = x.city; if (x.city) reg.lamp[x.lamp_id] = x.city; });
    else if (path.endsWith("/reports/pending")) items.forEach((x) => { reg.report[x.report_id] = x.city; if (x.city) reg.lamp[x.lamp_id] = x.city; });
    else if (path.endsWith("/listings")) items.forEach((x) => { reg.lamp[x.lamp_id] = x.city; });
    else if (path.endsWith("/users")) items.forEach((x) => { reg.user[x.user_id] = x.cities || []; });
    else if (path.endsWith("/homepage")) {
      (data.pins || []).forEach((p) => { const c = (p.lamp || {}).city; reg.pin[p.id] = c; if (c) reg.lamp[p.lamp_id] = c; });
      (data.feed_pins || []).forEach((x) => { reg.lamp[x.lamp_id] = x.city; });
      (data.approved_lamps || []).forEach((x) => { reg.lamp[x.lamp_id] = x.city; });
    }
    schedulePaint();
  }
  window.fetch = function (input, init) {
    let url = typeof input === "string" ? input : (input && input.url) || "";
    const method = String((init && init.method) || "GET").toUpperCase();
    let u = null;
    try { u = new URL(url, location.href); } catch (e) {}
    if (u && u.origin === location.origin && u.pathname.startsWith("/api/admin/")) {
      const isList = method === "GET" && LIST.test(u.pathname);
      if (isList && S.sel && !u.searchParams.has("city")) {
        u.searchParams.set("city", S.sel);
        url = u.pathname + u.search;
        if (typeof input !== "string") input = new Request(url, input); else input = url;
      }
      const p = rawFetch(input, init);
      p.then((r) => {
        if (!r.ok) return;
        if (isList) r.clone().json().then((d) => learn(u.pathname, d)).catch(() => {});
        else if (method !== "GET") scheduleSummary();
      }).catch(() => {});
      return p;
    }
    return rawFetch(input, init);
  };

  // ---- summary (per-city counts) -------------------------------------------------
  let sumT = 0;
  function scheduleSummary() { clearTimeout(sumT); sumT = setTimeout(loadSummary, 500); }
  async function loadSummary() {
    if (!token()) return;
    try {
      const r = await rawFetch("/api/admin/cities/summary", { headers: { Authorization: "Bearer " + token() }, cache: "no-store" });
      if (!r.ok) return;
      const d = await r.json();
      S.sum = d; S.scope = d.scope; S.isSuper = !!d.is_super;
      const names = (d.cities || []).map((x) => x.city);
      names.forEach((c) => tagClass(c));
      if (S.sel && !names.includes(S.sel)) setSel("", false);
      if (S.scope && S.scope.length === 1 && S.sel !== S.scope[0]) setSel(S.scope[0], true);
      renderBar();
      renderCard();
    } catch (e) {}
  }

  // ---- city bar --------------------------------------------------------------------
  function ensureBar() {
    const top = document.querySelector(".admin-body .topbar");
    if (!top) return null;
    let bar = document.getElementById("cityBar");
    if (!bar) {
      bar = document.createElement("div");
      bar.id = "cityBar";
      bar.setAttribute("role", "tablist");
      top.appendChild(bar);
      const sum = document.createElement("div");
      sum.id = "citySum";
      top.appendChild(sum);
      top.classList.add("has-city");
      bar.addEventListener("click", (ev) => {
        const b = ev.target.closest("[data-city]");
        if (b) setSel(b.dataset.city, true);
      });
    }
    return bar;
  }
  function renderBar() {
    const bar = ensureBar();
    if (!bar || !S.sum) return;
    const cities = S.sum.cities || [];
    const single = S.scope && S.scope.length === 1;
    const chip = (city, label, n) => `<button type="button" role="tab" class="cb-chip${S.sel === city ? " on" : ""}" data-city="${esc(city)}" aria-selected="${S.sel === city}">${esc(label)}<span class="cb-n${n ? "" : " zero"}">${n}</span></button>`;
    const html = (S.scope ? `<span class="cb-scope">负责</span>` : "") +
      (single ? "" : chip("", S.scope ? "我的城市" : "全部", (S.sum.total || {}).pending || 0)) +
      cities.map((x) => chip(x.city, x.city, x.pending)).join("");
    if (bar.innerHTML !== html) bar.innerHTML = html;
    const cur = S.sel ? cities.find((x) => x.city === S.sel) : S.sum.total;
    const sum = document.getElementById("citySum");
    if (sum && cur) {
      const t = `${esc(S.sel || (S.scope ? "我的城市" : "全部城市"))} · 待审 资料 <b>${cur.posts}</b> 评价 <b>${cur.reviews}</b> 举报 <b>${cur.reports}</b> ｜ 上架 <b>${cur.listings}</b> 置顶 <b>${cur.feed_pins}</b> 轮播 <b>${cur.carousel}</b>`;
      if (sum.innerHTML !== t) sum.innerHTML = t;
    }
    const top = document.querySelector(".admin-body .topbar");
    if (top) document.documentElement.style.setProperty("--ad-top", Math.round(top.getBoundingClientRect().height) + "px");
  }
  function setSel(city, reload) {
    S.sel = city || "";
    if (S.sel) localStorage.setItem(KEY, S.sel); else localStorage.removeItem(KEY);
    renderBar();
    renderCard();
    schedulePaint();
    if (!reload) return;
    document.getElementById("btnRefresh")?.click();
    const users = document.getElementById("adminUsers");
    if (users && users.children.length) document.getElementById("btnUserSearch")?.click();
  }

  // ---- row tags + client-side safety filter ---------------------------------------
  const LISTS = [
    ["#adminPosts", "post"], ["#adminReviews", "review"], ["#adminReports", "report"], ["#adminListings", "lamp"],
    ["#adminFeedPins", "lamp"], ["#adminPins", "pin"], ["#feedPinResults", "lamp"], ["#pinResults", "lamp"], ["#adminUsers", "user"],
  ];
  function rowCity(row, kind) {
    const lampEl = row.querySelector("[data-lamp]");
    const idEl = row.querySelector("[data-id]");
    if (kind === "pin" || kind === "lamp") {
      const lid = lampEl && lampEl.getAttribute("data-lamp");
      if (lid && reg.lamp[lid]) return reg.lamp[lid];
      const id = idEl && idEl.getAttribute("data-id");
      if (id == null) return undefined;
      return kind === "pin" ? (reg.pin[id] || reg.lamp[id]) : reg.lamp[id];
    }
    const id = idEl && idEl.getAttribute("data-id");
    return id == null ? undefined : reg[kind][id];
  }
  function paint() {
    LISTS.forEach(([sel, kind]) => {
      const box = document.querySelector(sel);
      if (!box) return;
      let shown = 0, rows = 0;
      [...box.children].forEach((row) => {
        if (row.classList.contains("city-empty") || !row.querySelector("[data-id],[data-lamp]")) return;
        rows++;
        const c = rowCity(row, kind);
        if (c === undefined) { shown++; return; }
        const list = kind === "user" ? (c || []) : [c || "未知"];
        const html = list.map(tagHtml).join("");
        // other admin scripts may move the card's children into wrappers: find our tag anywhere in the row
        const tags = row.querySelectorAll(".city-tag-row");
        for (let k = 1; k < tags.length; k++) tags[k].remove();
        let tag = tags[0] || null;
        if (html && !tag) { tag = document.createElement("div"); tag.className = "city-tag-row"; row.insertBefore(tag, row.firstChild); }
        if (tag && tag.innerHTML !== html) tag.innerHTML = html;
        if (tag && !html) tag.remove();
        const off = kind !== "user" && !!S.sel && (c || "未知") !== S.sel;
        if (row.classList.contains("city-off") !== off) row.classList.toggle("city-off", off);
        if (!off) shown++;
      });
      let empty = box.querySelector(":scope > .city-empty");
      const needEmpty = rows > 0 && shown === 0;
      if (needEmpty && !empty) { empty = document.createElement("p"); empty.className = "muted city-empty"; empty.textContent = `${S.sel} 暂无`; box.appendChild(empty); }
      if (!needEmpty && empty) empty.remove();
    });
  }
  let paintQ = false;
  function schedulePaint() {
    if (paintQ) return;
    paintQ = true;
    requestAnimationFrame(() => { paintQ = false; paint(); });
  }
  new MutationObserver(schedulePaint).observe(document.body, { childList: true, subtree: true });

  // ---- 站点设置: 城市公告 + 运营负责城市 -------------------------------------------
  async function loadOps() {
    if (!S.isSuper || S.ops) return;
    try {
      const r = await rawFetch("/api/admin/operators", { headers: { Authorization: "Bearer " + token() } });
      if (r.ok) { S.ops = await r.json(); renderCard(); }
    } catch (e) {}
  }
  function renderCard() {
    const pane = document.getElementById("pane-venue");
    if (!pane || !S.sum) return;
    let card = document.getElementById("cityCard");
    if (!card) {
      card = document.createElement("div");
      card.id = "cityCard";
      card.className = "ops-card";
      const h = pane.querySelector("h3");
      if (h) h.insertAdjacentElement("afterend", card); else pane.prepend(card);
      card.addEventListener("click", onCardClick);
    }
    const anns = S.sum.city_announcements || {};
    const cities = (S.sum.cities || []).map((x) => x.city);
    const canEdit = (c) => S.isSuper || (S.scope && S.scope.includes(c));
    let html = `<h4>城市</h4>`;
    if (S.sel) {
      const a = anns[S.sel] || {};
      html += `<label>${esc(S.sel)} 首页公告（只在${esc(S.sel)}显示；空着 = 用全站公告）</label>
        <textarea id="ccAnnText" rows="3"${canEdit(S.sel) ? "" : " disabled"}>${esc(a.text || "")}</textarea>
        <label class="row"><input type="checkbox" id="ccAnnOn"${a.text ? (a.enabled ? " checked" : "") : " checked"}${canEdit(S.sel) ? "" : " disabled"} /> 显示${esc(S.sel)}公告</label>
        ${canEdit(S.sel) ? `<button class="btn primary" type="button" data-cc="save-ann">保存${esc(S.sel)}公告</button>` : `<p class="muted">只有超管或负责${esc(S.sel)}的运营能改</p>`}`;
    } else {
      html += cities.map((c) => {
        const a = anns[c];
        return `<div class="cc-row">${tagHtml(c)}<span class="cc-ann">${a && a.enabled ? "公告：" + esc(a.text) : "用全站公告"}</span></div>`;
      }).join("") + `<p class="muted" style="margin:6px 0 0">在上方选一个城市可以单独设它的公告。</p>`;
    }
    if (S.isSuper) {
      const ops = (S.ops && S.ops.extra_admin_ids) || [];
      const map = (S.ops && S.ops.operator_cities) || {};
      html += `<h4 style="margin-top:14px">运营负责城市</h4><p class="muted" style="margin:0 0 6px">空着 = 全部城市（和现在一样）。可选：${esc(cities.join("、"))}</p>` +
        (ops.length ? ops.map((uid) => `<div class="cc-op"><code>${esc(uid)}</code><input data-op="${esc(uid)}" placeholder="全部城市" value="${esc((map[String(uid)] || []).join("，"))}" /></div>`).join("") +
          `<button class="btn" type="button" data-cc="save-ops">保存负责城市</button>` : `<p class="muted">还没有运营管理员</p>`);
    }
    html += `<p class="muted" style="margin:10px 0 0">下面的设置对所有城市生效。</p>`;
    const active = document.activeElement;
    if (active && card.contains(active) && /TEXTAREA|INPUT/.test(active.tagName)) return; // don't clobber typing
    if (card.innerHTML !== html) card.innerHTML = html;
    if (S.isSuper && !S.ops) loadOps();
  }
  async function post(path, body) {
    const r = await rawFetch(path, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.detail || "保存失败");
    return d;
  }
  async function onCardClick(ev) {
    const b = ev.target.closest("[data-cc]");
    if (!b) return;
    b.disabled = true;
    try {
      if (b.dataset.cc === "save-ann") {
        const d = await post("/api/admin/cities/announcement", { city: S.sel, text: document.getElementById("ccAnnText").value, enabled: document.getElementById("ccAnnOn").checked });
        S.sum.city_announcements = d.city_announcements || {};
        alert(`${S.sel} 公告已保存`);
      } else if (b.dataset.cc === "save-ops") {
        const map = {};
        document.querySelectorAll("#cityCard [data-op]").forEach((inp) => {
          const list = inp.value.split(/[,，、\s]+/).map((x) => x.trim()).filter(Boolean);
          if (list.length) map[inp.dataset.op] = list;
        });
        const d = await post("/api/admin/operators/cities", { operator_cities: map });
        S.ops = Object.assign({}, S.ops, { operator_cities: d.operator_cities || {} });
        alert("负责城市已保存");
      }
    } catch (e) { alert(e.message || String(e)); }
    b.disabled = false;
    renderCard();
  }

  // boot: wait for the admin token, then load counts; refresh counts on 刷新
  document.getElementById("btnRefresh")?.addEventListener("click", scheduleSummary);
  let tries = 0;
  (function boot() {
    if (token() && document.getElementById("console") && !document.getElementById("console").classList.contains("hidden")) { loadSummary(); return; }
    if (++tries < 60) setTimeout(boot, 250);
  })();
})();
