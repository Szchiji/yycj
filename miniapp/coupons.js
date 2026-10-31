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
  function display() { const d = (window.__yycjHomeData || {}).coupon_display; return d == null ? "badge,filter,list" : String(d); }
  window.__yycjCouponMode = (k) => display().split(",").includes(k);
  function toast(msg) { const el = $("#toast"); if (!el) return; el.textContent = msg; el.classList.remove("hidden", "err"); clearTimeout(toast.t); toast.t = setTimeout(() => el.classList.add("hidden"), 2600); }
  async function api(path, opt = {}) {
    const r = await fetch(path, Object.assign({}, opt, { headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() } }));
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.detail || "请求失败");
    return d;
  }
  // 约课用优惠: the guest sends the code to the teacher when booking
  const bookText = (code, text) => `你好，我想约课，使用优惠券：${code}（${text}）`;
  function copy(text) {
    try { if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(text).catch(() => legacyCopy(text)); return true; } } catch (e) {}
    return legacyCopy(text);
  }
  function legacyCopy(text) {
    try { const t = document.createElement("textarea"); t.value = text; t.setAttribute("readonly", ""); t.style.cssText = "position:fixed;left:-9999px;top:0";
      document.body.appendChild(t); t.select(); const ok = document.execCommand("copy"); t.remove(); return ok; } catch (e) { return false; }
  }
  let held = null;   // {lamp, code, text} — unused, valid code for the open listing
  // contact links that are a plain t.me/<username> accept ?text= — prefill the booking line there
  function prefillLinks() {
    const box = $("#detail"); if (!box) return;
    box.querySelectorAll("a.tg-link").forEach((a) => {
      const raw = a.getAttribute("data-orig") || a.getAttribute("href") || "";
      if (!a.getAttribute("data-orig")) a.setAttribute("data-orig", raw);
      const m = /^https:\/\/t\.me\/([A-Za-z][A-Za-z0-9_]{3,31})\/?$/.exec(raw);
      const url = held && m && !/bot$/i.test(m[1]) ? raw.replace(/\/$/, "") + "?text=" + encodeURIComponent(bookText(held.code, held.text)) : raw;
      a.setAttribute("href", url); if (a.hasAttribute("data-tg")) a.setAttribute("data-tg", url);
    });
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
    if (!c) { held = null; prefillLinks(); if (el) el.remove(); return; }
    if (!el) {
      el = document.createElement("div"); el.className = "cpn-block";
      const price = card.querySelector(".xhs-price"); if (price) price.after(el); else card.prepend(el);
    }
    el.dataset.lamp = id; el.dataset.ok = "1";
    held = c.my_code && c.my_valid && !c.own ? { lamp: id, code: c.my_code, text: c.text } : null;
    prefillLinks();
    const act = c.own ? `<span class="cpn-own">你发的优惠</span>`
      : c.my_code ? `<div class="cpn-code"><span>我的券码</span><b>${esc(c.my_code)}</b>${c.my_used ? "<i>已用</i>" : (c.my_valid ? `<button type="button" class="cpn-copy" data-cpn-copy="${esc(c.my_code)}" data-cpn-t="${esc(c.text)}">复制券码</button>` : "<i>已失效</i>")}</div>`
      : c.live ? `<button type="button" class="btn primary cpn-claim" data-cpn-claim="${esc(c.coupon_id)}">领取</button>`
      : `<span class="cpn-off">${esc(STATUS[c.status] || "已结束")}</span>`;
    el.innerHTML = `<div class="cpn-l"><span class="cpn-tag">惠</span><div><b>${esc(c.text)}</b><small>${esc(c.left)} · ${esc(quotaTxt(c))}</small></div></div>${act}
      ${c.my_code && c.my_valid ? `<p class="cpn-tip">约课时把券码发给老师（点「${esc(ctaLabel())}」会自动复制好）。有效至优惠结束：${esc(c.left)}。</p>` : ""}`;
  }
  function ctaLabel() { return String((window.__yycjHome || {}).chat_cta_label || "想聊聊").slice(0, 12); }
  const watchDetail = () => {
    const box = $("#detail"); if (!box || !window.MutationObserver) return;
    let t = 0;
    new MutationObserver(() => { clearTimeout(t); t = setTimeout(() => { if (held && held.lamp !== box.getAttribute("data-lamp")) held = null; paintDetail(); prefillLinks(); }, 120); }).observe(box, { childList: true, subtree: true, attributes: true, attributeFilter: ["data-lamp"] });
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
        ${findHtml()}
        <div class="cpn-sub">谁领了（客人约课时会把券码发给你）</div>
        ${rows ? `<ul class="cpn-claims">${rows}</ul>` : "<p class='muted'>还没有人领取</p>"}`;
      return;
    }
    if (!d.can_issue) { card.innerHTML = "<h3>我的优惠</h3><p class='muted'>资料上架后，可以在这里发限时优惠，比如「P100 PP200 两天有效」。</p>"; return; }
    card.innerHTML = `<h3>我的优惠</h3>${d.has_claims ? findHtml() : ""}
      <p class="muted cpn-lead">发一个限时优惠，客人在你的详情页领取，到店出示券码。同一时间只能有 1 个。</p>
      <input id="cpnText" maxlength="${d.max_text}" placeholder="优惠内容，比如 P100 PP200" value="${esc(draft.text || "")}" />
      <div class="cpn-row"><span>有效期</span>${d.presets.map((n) => `<button type="button" class="area-chip${draft.days === n ? " on" : ""}" data-cpn-days="${n}">${n}天</button>`).join("")}</div>
      <div class="cpn-row"><span>限量</span><input id="cpnQuota" type="number" min="1" max="${d.max_quota}" inputmode="numeric" placeholder="不填 = 不限" value="${esc(draft.quota || "")}" /><em>张</em></div>
      <button type="button" class="btn primary block" data-cpn-new="1">发布优惠</button>
      <p class="muted cpn-tip">发出后立即显示；违规内容后台会停用。</p>`;
  }
  let found = null;
  function findHtml() {
    const r = found;
    const res = !r ? "" : r.err ? `<p class="cpn-find-r muted">${esc(r.err)}</p>`
      : `<div class="cpn-find-r"><b>${esc(r.code)}</b><span>${esc(r.who)} · ${esc(r.text)} · ${r.used ? "已用" : r.valid ? "有效" : "已失效"}</span>
        ${r.valid || r.used ? `<button type="button" class="btn${r.used ? "" : " primary"}" data-cpn-use="${esc(r.code)}" data-used="${r.used ? 0 : 1}">${r.used ? "已用 ↺" : "标记已用"}</button>` : ""}</div>`;
    return `<div class="cpn-find"><input id="cpnFind" maxlength="12" placeholder="输入客人发来的券码" value="${esc((r && r.q) || "")}" autocapitalize="characters" /><button type="button" class="btn" data-cpn-find="1">核对</button></div>${res}`;
  }
  async function paintGuest() {
    let items = [];
    try { items = (await api("/api/me/claims")).items || []; } catch (e) {}
    const card = ensureCard("myClaims");
    if (!card) return;
    if (!items.length) { card.innerHTML = "<h3>我的优惠券</h3><p class='muted'>在老师详情页领取的优惠会在这里，到店出示券码即可。</p>"; }
    else card.innerHTML = "<h3>我的优惠券</h3><ul class='cpn-mine'>" + items.map((c) => `<li data-cpn-open="${esc(c.lamp_id)}">
      <div><b>${esc(c.title)}</b><span>${esc(c.text)}</span><small>${c.my_used ? "已用" : c.my_valid ? "有效 · " + esc(c.left) : "已失效"}</small></div>
      <div class="cpn-mc"><code class="${c.my_valid ? "" : "used"}">${esc(c.my_code)}</code>${c.my_valid ? `<button type="button" class="cpn-copy" data-cpn-copy="${esc(c.my_code)}" data-cpn-t="${esc(c.text)}">复制券码</button>` : ""}</div></li>`).join("") + "</ul>" +
      "<p class='muted cpn-tip'>约课时把券码发给老师，老师在「我的优惠」里核销。券码在优惠结束时间前有效。</p>";
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
      if (!confirm("提前结束这个优惠？不能再领；已领的券码在原定结束时间前仍然有效。")) return;
      try { await api("/api/me/coupon/end", { method: "POST" }); toast("已结束"); paintTeacher(); } catch (e) { toast(e.message); }
      return;
    }
    const use = t.closest && t.closest("[data-cpn-use]");
    if (use) {
      try {
        const code = use.getAttribute("data-cpn-use");
        await api("/api/me/coupon/use", { method: "POST", body: JSON.stringify({ code, used: use.getAttribute("data-used") === "1" }) });
        if (found && found.code === code) { try { found = Object.assign((await api("/api/me/coupon/code?code=" + encodeURIComponent(code))).claim, { q: found.q }); } catch (e) {} }
        toast(use.getAttribute("data-used") === "1" ? "已核销" : "已撤销核销"); paintTeacher();
      } catch (e) { toast(e.message); }
      return;
    }
    if (t.closest && t.closest("[data-cpn-find]")) {
      const q = (($("#cpnFind") || {}).value || "").trim().toUpperCase();
      if (!q) return toast("请输入券码");
      try { found = Object.assign((await api("/api/me/coupon/code?code=" + encodeURIComponent(q))).claim, { q }); }
      catch (e) { found = { err: e.message, q }; }
      paintTeacher(); return;
    }
    const cp = t.closest && t.closest("[data-cpn-copy]");
    if (cp) { copy(bookText(cp.getAttribute("data-cpn-copy"), cp.getAttribute("data-cpn-t") || "")); toast("已复制券码，发给老师即可"); return; }
    // 想聊聊 / 约课 with a valid code: copy the booking line first (the relay chat can't be prefilled)
    if (held && t.closest && t.closest("#detailChat")) {
      copy(bookText(held.code, held.text)); toast("已复制券码，发给老师即可");
    }
    const tl = held && t.closest && t.closest("#detail a.tg-link");
    if (tl) { copy(bookText(held.code, held.text)); }
    const op = t.closest && t.closest("[data-cpn-open]");
    if (op) { openLamp(op.getAttribute("data-cpn-open")); return; }
    if (t.closest && t.closest('[data-nav="me"], [data-switch]')) setTimeout(paintMe, 400);
  }, true);
  const boot = () => { watchDetail(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
