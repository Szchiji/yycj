// 优惠券 (inspired by 繁花's 优惠): 老师在「我的 · 我的优惠」发限时优惠；客人在详情页「领取」拿到 6 位码，到店出示。
// Where guests see coupons is a site setting (coupon_display): badge = 卡片称呼前小「惠」字,
// filter = 筛选面板「有优惠」, list = 「我的 · 本城优惠」. The detail-page block is always on. Card size/grid unchanged.
(() => {
  if (window.__yycjCoupons) return;
  window.__yycjCoupons = true;
  const $ = (s) => document.querySelector(s);
  const token = () => localStorage.getItem("yycj_token") || "";
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  function role() { try { return JSON.parse(localStorage.getItem("yycj_user") || "{}").role || localStorage.getItem("yycj_role") || "guest"; } catch (e) { return "guest"; } }
  const isTeacher = () => role() === "teacher" || role() === "merchant";
  function display() { const d = (window.__yycjHomeData || {}).coupon_display; return d == null ? "badge" : String(d); }
  window.__yycjCouponMode = (k) => display().split(",").includes(k);
  function toast(msg) { const el = $("#toast"); if (!el) return; el.textContent = msg; el.classList.remove("hidden", "err"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.add("hidden"), 2600); }
  async function api(path, opt = {}) {
    const r = await fetch(path, Object.assign({}, opt, { headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() } }));
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.detail || "请求失败");
    return d;
  }
  const quotaTxt = (c) => c.quota ? `限${c.quota}张 · 剩${c.remain}张` : "不限量";
  const STATUS = { expired: "已结束", sold_out: "已领完", ended: "已结束", stopped: "已停用" };

  // ---- detail page block ----
  async function paintDetail() {
    const box = $("#detail"); if (!box) return;
    const id = box.getAttribute("data-lamp") || ""; if (!id) return;
    const card = box.querySelector(".card") || box;
    let el = card.querySelector(".cpn-block");
    if (el && el.dataset.lamp === id && el.dataset.ok) return;
    let c = null;
    try { c = (await api("/api/lamps/" + encodeURIComponent(id) + "/coupon")).coupon; } catch (e) { return; }
    if ((box.getAttribute("data-lamp") || "") !== id) return;
    el = card.querySelector(".cpn-block");
    if (!c) { if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement("div"); el.className = "cpn-block";
      const price = card.querySelector(".xhs-price"); if (price) price.after(el); else card.prepend(el);
    }
    el.dataset.lamp = id; el.dataset.ok = "1";
    const act = c.own ? `<span class="cpn-own">你发的优惠</span>`
      : c.my_code ? `<div class="cpn-code"><span>我的券码</span><b>${esc(c.my_code)}</b>${c.my_used ? "<i>已用</i>" : ""}</div>`
      : c.live ? `<button type="button" class="btn primary cpn-claim" data-cpn-claim="${esc(c.coupon_id)}">领取</button>`
      : `<span class="cpn-off">${esc(STATUS[c.status] || "已结束")}</span>`;
    el.innerHTML = `<div class="cpn-l"><span class="cpn-tag">惠</span><div><b>${esc(c.text)}</b><small>${esc(c.left)} · ${esc(quotaTxt(c))}</small></div></div>${act}
      ${c.my_code ? '<p class="cpn-tip">到店时把券码给老师看。也在「我的 · 我的优惠券」里。</p>' : ""}`;
  }
  const watchDetail = () => {
    const box = $("#detail"); if (!box || !window.MutationObserver) return;
    let t = 0;
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(paintDetail, 120); }).observe(box, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-lamp"] });
  };

  // ---- 我的 ----
  function ensureCard(id, after) {
    const me = $("#view-me"); if (!me) return null;
    let card = document.getElementById(id);
    if (!card) {
      card = document.createElement("div"); card.id = id; card.className = "card cpn-card";
      const a = after && document.querySelector(after);
      if (a) a.after(card); else { const f = me.querySelector("#meCard"); if (f) f.after(card); else me.prepend(card); }
    }
    return card;
  }
  let draft = { days: 2 };
  async function paintTeacher() {
    const card = ensureCard("myCoupon"); if (!card) return;
    let d;
    try { d = await api("/api/me/coupon"); } catch (e) { card.innerHTML = "<h3>我的优惠</h3><p class='muted'>加载失败</p>"; return; }
    if (!d.enabled) { card.remove(); return; }
    if (d.current) {
      const c = d.current;
      const rows = (d.claims || []).map((x) => `<li><b>${esc(x.code)}</b><span>${esc(x.who)}</span>
        <button type="button" class="btn${x.used ? "" : " primary"} cpn-use" data-cpn-use="${esc(x.code)}" data-used="${x.used ? 0 : 1}">${x.used ? "已用 ↺" : "标记已用"}</button></li>`).join("");
      card.innerHTML = `<h3>我的优惠</h3>
        <div class="cpn-block mine"><div class="cpn-l"><span class="cpn-tag">惠</span><div><b>${esc(c.text)}</b><small>${esc(c.left)} · 已领 ${c.claimed}${c.quota ? "/" + c.quota : ""}</small></div></div>
        <button type="button" class="btn" data-cpn-end="1">提前结束</button></div>
        <div class="cpn-sub">谁领了（客人到店出示券码）</div>
        ${rows ? `<ul class="cpn-claims">${rows}</ul>` : "<p class='muted'>还没有人领取</p>"}`;
      return;
    }
    if (!d.can_issue) { card.innerHTML = "<h3>我的优惠</h3><p class='muted'>资料上架后，可以在这里发限时优惠，比如「P100 PP200 两天有效」。</p>"; return; }
    card.innerHTML = `<h3>我的优惠</h3>
      <p class="muted cpn-lead">发一个限时优惠，客人在你的详情页领取，到店出示券码。同一时间只能有 1 个。</p>
      <input id="cpnText" maxlength="${d.max_text}" placeholder="优惠内容，比如 P100 PP200" value="${esc(draft.text || "")}" />
      <div class="cpn-row"><span>有效期</span>${d.presets.map((n) => `<button type="button" class="area-chip${draft.days === n ? " on" : ""}" data-cpn-days="${n}">${n}天</button>`).join("")}</div>
      <div class="cpn-row"><span>限量</span><input id="cpnQuota" type="number" min="1" max="${d.max_quota}" inputmode="numeric" placeholder="不填 = 不限" value="${esc(draft.quota || "")}" /><em>张</em></div>
      <button type="button" class="btn primary block" data-cpn-new="1">发布优惠</button>
      <p class="muted cpn-tip">发出后立即显示；违规内容后台会停用。</p>`;
  }
  async function paintGuest() {
    let items = [];
    try { items = (await api("/api/me/claims")).items || []; } catch (e) {}
    const card = ensureCard("myClaims");
    if (!card) return;
    if (!items.length) { card.innerHTML = "<h3>我的优惠券</h3><p class='muted'>在老师详情页领取的优惠会在这里，到店出示券码即可。</p>"; }
    else card.innerHTML = "<h3>我的优惠券</h3><ul class='cpn-mine'>" + items.map((c) => `<li data-cpn-open="${esc(c.lamp_id)}">
      <div><b>${esc(c.title)}</b><span>${esc(c.text)}</span><small>${esc(c.live || c.status === "sold_out" ? c.left : (STATUS[c.status] || c.left))}</small></div>
      <code class="${c.my_used ? "used" : ""}">${esc(c.my_code)}</code></li>`).join("") + "</ul>";
  }
  async function paintCityList() {
    const card = ensureCard("cityCoupons", "#myClaims");
    if (!card) return;
    if (!window.__yycjCouponMode("list")) { card.remove(); return; }
    const city = localStorage.getItem("yycj_city") || "";
    let items = [];
    try { items = (await api("/api/coupons?city=" + encodeURIComponent(city))).items || []; } catch (e) {}
    card.innerHTML = `<h3>本城优惠 <small class="muted">${esc(city)}</small></h3>` + (items.length ? "<ul class='cpn-list'>" + items.map((c) => `<li data-cpn-open="${esc(c.lamp_id)}">
      <span class="cpn-tag">惠</span><div><b>${esc(c.title)}<i>${esc(c.district)}</i></b><span>${esc(c.text)}</span><small>${esc(c.left)} · ${esc(quotaTxt(c))}</small></div><em>›</em></li>`).join("") + "</ul>"
      : "<p class='muted'>这个城市暂时没有优惠</p>");
  }
  async function paintMe() {
    if (isTeacher()) { paintTeacher(); const g = $("#myClaims"); if (g) g.remove(); const l = $("#cityCoupons"); if (l) l.remove(); }
    else { const t = $("#myCoupon"); if (t) t.remove(); await paintGuest(); paintCityList(); }
  }
  function openLamp(id) {
    if (window.__yycjOpenLampById) { window.__yycjOpenLampById(id); return; }
    const fake = document.createElement("div"); fake.setAttribute("data-id", id); fake.style.display = "none";
    const feed = $("#feed"); if (!feed) return;
    feed.appendChild(fake); fake.click(); fake.remove();
  }

  document.addEventListener("click", async (ev) => {
    const t = ev.target;
    const cl = t.closest && t.closest("[data-cpn-claim]");
    if (cl) {
      cl.disabled = true;
      try { await api("/api/coupons/" + encodeURIComponent(cl.getAttribute("data-cpn-claim")) + "/claim", { method: "POST" }); toast("领取成功，到店出示券码"); const b = $("#detail .cpn-block"); if (b) delete b.dataset.ok; paintDetail(); }
      catch (e) { toast(e.message); cl.disabled = false; }
      return;
    }
    const dy = t.closest && t.closest("[data-cpn-days]");
    if (dy) { draft.text = ($("#cpnText") || {}).value || ""; draft.quota = ($("#cpnQuota") || {}).value || ""; draft.days = +dy.getAttribute("data-cpn-days"); paintTeacher(); return; }
    if (t.closest && t.closest("[data-cpn-new]")) {
      const body = { text: ($("#cpnText") || {}).value || "", days: draft.days, quota: parseInt(($("#cpnQuota") || {}).value || "0", 10) || 0 };
      try { await api("/api/me/coupon", { method: "POST", body: JSON.stringify(body) }); draft = { days: 2 }; toast("优惠已发布"); paintTeacher(); } catch (e) { toast(e.message); }
      return;
    }
    if (t.closest && t.closest("[data-cpn-end]")) {
      if (!confirm("提前结束这个优惠？已领的券码仍然有效。")) return;
      try { await api("/api/me/coupon/end", { method: "POST" }); toast("已结束"); paintTeacher(); } catch (e) { toast(e.message); }
      return;
    }
    const use = t.closest && t.closest("[data-cpn-use]");
    if (use) { try { await api("/api/me/coupon/use", { method: "POST", body: JSON.stringify({ code: use.getAttribute("data-cpn-use"), used: use.getAttribute("data-used") === "1" }) }); paintTeacher(); } catch (e) { toast(e.message); } return; }
    const op = t.closest && t.closest("[data-cpn-open]");
    if (op) { openLamp(op.getAttribute("data-cpn-open")); return; }
    if (t.closest && t.closest('[data-nav="me"], [data-switch]')) setTimeout(paintMe, 400);
  }, true);
  const boot = () => { watchDetail(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
