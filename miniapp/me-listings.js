(() => {
  if (window.__yycjMeListings) return;
  window.__yycjMeListings = true;
  const token = () => localStorage.getItem("yycj_token") || "";
  function role() {
    try { return JSON.parse(localStorage.getItem("yycj_user") || "{}").role || "guest"; }
    catch (e) { return "guest"; }
  }
  function mount() {
    const me = document.getElementById("view-me");
    if (!me) return;
    if (!document.getElementById("myReviews")) {
      const hold = document.createElement("div");
      hold.id = "myReviews";
      hold.className = "hidden";
      me.appendChild(hold);
    }
    if (role() === "guest") {
      const old = document.getElementById("myListings");
      if (old && old.parentElement) old.parentElement.remove();
      return;
    }
    if (document.getElementById("myListings")) return;
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = "<h3>我的上架</h3><div id=\"myListings\" class=\"muted\">加载中…</div>";
    const first = me.querySelector(".card");
    if (first) first.after(card);
    else me.prepend(card);
  }
  function esc(t) {
    return String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":"&#39;" }[c]));
  }
  function shiftHtml(sh, lead) {
    const code = sh.code || "unset";
    if (code === "unset" || !sh.hours) {
      return `<div class="shift-head"><span class="shift-pill" data-code="unset">未设营业时间</span></div>
        <p class="shift-note muted">点「改资料」设置营业时间后，首页才会显示 营业中 / 未到点 / 已打烊。</p>`;
    }
    const word = sh.shift_word || "今天";
    const when = sh.shift_start ? `${word} ${sh.shift_start} 这一班` : "今天";
    let note;
    if (sh.auto && sh.choice !== "rest") note = `自动营业：到点自动显示营业中，不用每天确认。`;
    else if (sh.choice === "open") note = `已确认 ${when} 开课。`;
    else if (sh.choice === "rest") note = sh.missed ? `${when}没回复提醒，按休息算；${sh.remind_on ? "明天照常提醒" : ""}` : `已设 ${when} 休息，只管这一次。`;
    else note = sh.remind_on ? `${when}还没确认，开工前 ${lead} 分钟机器人会问你。` : `${when}还没确认（每日提醒已关）。`;
    const on = (a) => (sh.choice === a ? " on" : "");
    return `<div class="shift-head"><span class="shift-pill" data-code="${esc(code)}">${esc(sh.text || "")}</span><span class="muted">营业 ${esc(sh.hours)}</span></div>
      <p class="shift-note muted">${esc(note)}</p>
      <div class="shift-btns"><button class="btn${on("open")}" type="button" data-act="open">今日开课</button><button class="btn${on("rest")}" type="button" data-act="rest">今日休息</button></div>
      <label class="shift-sw"><span>每日开课提醒<small>开工前 ${lead} 分钟私聊问你，关掉就不再问</small></span><input type="checkbox" data-sw="remind"${sh.remind_on ? " checked" : ""}${sh.auto ? " disabled" : ""} /></label>
      <label class="shift-sw"><span>按营业时间自动营业<small>不用每天确认，休息时点「今日休息」</small></span><input type="checkbox" data-sw="auto"${sh.auto ? " checked" : ""} /></label>`;
  }
  async function postShift(id, action) {
    const r = await fetch("/api/me/listings/" + encodeURIComponent(id) + "/shift", {
      method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() },
      body: JSON.stringify({ action }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.detail || "操作失败");
    return data;
  }
  function toast(msg) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
    setTimeout(() => el.classList.add("hidden"), 2600);
  }
  function bindShift(el, lead) {
    const id = el.getAttribute("data-shift");
    el.addEventListener("click", async (ev) => {
      const b = ev.target.closest("[data-act]");
      if (!b) return;
      try { const d = await postShift(id, b.getAttribute("data-act")); el.innerHTML = shiftHtml(d.shop || {}, lead); toast(d.message || "已保存"); }
      catch (e) { toast(e.message || String(e)); }
    });
    el.addEventListener("change", async (ev) => {
      const sw = ev.target.closest("[data-sw]");
      if (!sw) return;
      const action = sw.getAttribute("data-sw") + (sw.checked ? "_on" : "_off");
      try { const d = await postShift(id, action); el.innerHTML = shiftHtml(d.shop || {}, lead); toast(d.message || "已保存"); }
      catch (e) { sw.checked = !sw.checked; toast(e.message || String(e)); }
    });
  }
  async function load() {
    mount();
    const box = document.getElementById("myListings");
    if (!box || !token() || role() === "guest") return;
    try {
      const r = await fetch("/api/me/listings", { headers: { Authorization: "Bearer " + token() } });
      const data = await r.json();
      const items = data.items || [];
      if (!items.length) {
        box.innerHTML = "<p class='muted'>还没有上架记录</p>";
        return;
      }
      const lead = data.remind_lead_min || 30;
      box.innerHTML = items.map((x) => {
        const st = x.status === "active" ? "已上架" : x.status === "hidden" ? "已下架" : x.status;
        return `<div class="pick-item" style="margin:8px 0" data-lamp="${esc(x.lamp_id)}">
          <div><strong>${esc(x.title || "")}</strong>
          <div class="muted">${esc(x.city || "")} · ${esc(st)} · ${x.expires_at ? ("到期 " + esc(String(x.expires_at).slice(0,10))) : ""}</div></div>
          <button class="btn" type="button" data-edit="${esc(x.lamp_id)}">改资料</button>
        </div>${x.status === "active" ? `<div class="shift-box" data-shift="${esc(x.lamp_id)}">${shiftHtml(x.shop || {}, lead)}</div>` : ""}`;
      }).join("");
      box.querySelectorAll("[data-shift]").forEach((el) => bindShift(el, lead));
      box.querySelectorAll("[data-edit]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-edit");
          const item = items.find((x) => x.lamp_id === id);
          document.querySelector('[data-nav="publish"]')?.click();
          const form = document.getElementById("publishForm");
          if (!form || !item) return;
          let h = document.getElementById("editLampId");
          if (!h) { h = document.createElement("input"); h.type = "hidden"; h.id = "editLampId"; form.appendChild(h); }
          h.value = item.lamp_id;
          const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ""; };
          set("pubTitle", item.title);
          set("pubCity", item.city);
          set("pubDesc", item.description);
          set("pubPrice", item.price_text);
          set("pubDistrict", item.district);
          set("pubApprox", item.approx_label);
          set("pubTags", (item.tags || []).join(" "));
          const extras = item.extras || {};
          const hp = document.getElementById("pubHours");
          const hv = (item.hours && item.hours.length) ? item.hours : (extras["营业时间"] || []);
          if (window.yycjHours && hp) { window.yycjHours.set(hp, hv); setTimeout(() => window.yycjHours.set(hp, hv), 200); }
          document.querySelectorAll("[data-extra]").forEach((inp) => {
            const k = inp.getAttribute("data-extra");
            if (k && extras[k] != null) inp.value = extras[k];
          });
          const t = document.getElementById("publishTitle");
          if (t) t.textContent = "改资料（需再审）";
        });
      });
    } catch (e) {
      box.textContent = "加载失败";
    }
  }
  document.addEventListener("click", (ev) => {
    if (ev.target && ev.target.getAttribute && ev.target.getAttribute("data-nav") === "me") setTimeout(load, 200);
  });
  if (document.readyState === "complete") { mount(); setTimeout(load, 1200); }
  else window.addEventListener("load", () => { mount(); setTimeout(load, 1200); });
})();
