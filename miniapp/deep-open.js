(() => {
  if (window.__yycjDeepOpen) return;
  window.__yycjDeepOpen = true;
  function restore(raw) {
    let s = String(raw || "").trim();
    if (!s) return "";
    if (s.startsWith("s_")) s = s.slice(2);
    s = s.replace(/-/g, "");
    if (s.length === 32) {
      return s.slice(0, 8) + "-" + s.slice(8, 12) + "-" + s.slice(12, 16) + "-" + s.slice(16, 20) + "-" + s.slice(20);
    }
    return String(raw || "").replace(/^s_/, "");
  }
  function lampId() {
    const q = new URLSearchParams(location.search || "");
    const fromQ = q.get("lamp") || q.get("id") || "";
    if (fromQ) return restore(fromQ) || fromQ;
    const tg = window.Telegram && window.Telegram.WebApp;
    const sp = (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || "";
    if (sp) return restore(sp);
    // Only a reload inside the same session reopens it (it used to live in localStorage, so every
    // later normal open of the app jumped to the last shared listing).
    try { return sessionStorage.getItem("yycj_open_lamp") || ""; } catch (e) { return ""; }
  }
  function showDetail() {
    document.getElementById("boot")?.classList.add("hidden");
    document.getElementById("gate")?.classList.add("hidden");
    document.getElementById("app")?.classList.remove("hidden");
    document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
    document.getElementById("view-detail")?.classList.remove("hidden");
  }
  function esc(t) {
    return String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":"&#39;" }[c]));
  }
  function paint(lamp) {
    const box = document.getElementById("detail");
    if (!box || !lamp) return;
    box.setAttribute("data-lamp", lamp.lamp_id || "");
    const loc = [lamp.city, lamp.district, lamp.approx_label].filter(Boolean).join(" · ");
    box.innerHTML = `<div class="card">
      <h3>${String(lamp.title || "").replace(/[<>]/g, "")}</h3>
      <p class="muted">📍 ${String(loc || "").replace(/[<>]/g, "")}</p>
      <div class="muted">💰 ${String(lamp.price_text || "面议").replace(/[<>]/g, "")}</div>
      <p>${String(lamp.description || "").replace(/[<>]/g, "")}</p>
      <div class="row">
        <button class="btn primary" id="detailChat" data-lamp="${esc(lamp.lamp_id || "")}" type="button">想聊聊</button>
        <button class="btn" id="detailReview" type="button">写评价</button>
        <button class="btn" id="detailShare" data-share="${esc(lamp.lamp_id || "")}" type="button">分享</button>
      </div>
    </div>`;
    window.__yycjOpenLamp = lamp.lamp_id || "";
    showDetail();
    // same extras as a detail opened from a card: photo/video gallery, tags, extras, reviews
    try { window.__yycjPaintGallery && window.__yycjPaintGallery(lamp.lamp_id); } catch (e) {}
    try { window.__yycjLoadDetailExtras && window.__yycjLoadDetailExtras(lamp.lamp_id); } catch (e) {}
  }
  async function openLamp(id) {
    if (!id) return;
    try { sessionStorage.setItem("yycj_open_lamp", id); localStorage.removeItem("yycj_open_lamp"); } catch (e) {}
    showDetail();
    const token = localStorage.getItem("yycj_token") || "";
    if (!token) return;
    try {
      const r = await fetch("/api/lamps/" + encodeURIComponent(id), { headers: { Authorization: "Bearer " + token } });
      if (!r.ok) return;
      const data = await r.json();
      paint(data.lamp || data);
    } catch (e) {}
  }
  async function boot() {
    const id = lampId();
    if (!id) return;
    // Wait until app.js has logged in and routed to home (it shows #view-home after /api/auth);
    // opening earlier got overwritten by that route on slow networks.
    const ready = () => {
      const app = document.getElementById("app");
      const home = document.getElementById("view-home");
      return localStorage.getItem("yycj_token") && app && !app.classList.contains("hidden") && home && !home.classList.contains("hidden");
    };
    for (let i = 0; i < 100 && !ready(); i += 1) await new Promise((r) => setTimeout(r, 100));
    await openLamp(id);
  }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
