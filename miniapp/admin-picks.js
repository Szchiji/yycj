(() => {
  const $ = (s) => document.querySelector(s);
  const token = () => localStorage.getItem("yycj_token") || "";
  if (!document.getElementById("yycj-pick-css")) {
    const st = document.createElement("style");
    st.id = "yycj-pick-css";
    st.textContent = `.admin-thumb{width:56px;height:56px;object-fit:cover;border-radius:10px;background:#0d1326;flex:none;}
.admin-thumb.ph{background:#1a2140;}
.pick-now{display:flex;align-items:center;gap:10px;padding:10px;border:1px solid #2a3352;border-radius:14px;margin:8px 0;background:#151b2f;}
.pick-now .meta{flex:1;min-width:0;}
.pick-now .meta strong{display:block;}
.pick-item{display:grid;grid-template-columns:1fr auto;gap:8px 10px;align-items:center;padding:10px;border:1px solid #2a3352;border-radius:14px;margin:8px 0;background:#151b2f;}
.pick-item .hrs{width:100%;margin:0;grid-column:1 / -1;}
#btnSide{display:none!important;}`;
    document.head.appendChild(st);
  }
  function esc(t) {
    return String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":"&#39;" }[c]));
  }
  function mediaSrc(item) {
    const lamp = (item && item.lamp) || item || {};
    for (const m of lamp.media || []) {
      if ((m && m.type) === "video") continue;
      const raw = String((m && (m.preview_url || m.file_id || m.url)) || "").trim();
      if (!raw) continue;
      if (raw.startsWith("http") || raw.startsWith("/")) return raw;
      return "/api/media/file/" + encodeURIComponent(raw);
    }
    for (const p of lamp.photos || item.photos || []) {
      const raw = String(p || "");
      if (!raw || raw.startsWith("BAAC")) continue;
      if (raw.startsWith("http") || raw.startsWith("/")) return raw;
      return "/api/media/file/" + encodeURIComponent(raw);
    }
    return "";
  }
  async function api(path, opt) {
    const r = await fetch(path, Object.assign({
      headers: { Authorization: "Bearer " + token(), "Content-Type": "application/json" },
    }, opt || {}));
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.detail || r.statusText);
    return data;
  }
  function card(item, btnHtml) {
    const src = mediaSrc(item);
    const loc = [item.city, item.district].filter(Boolean).join(" · ");
    return `<div class="pick-now">
      ${src ? `<img class="admin-thumb" src="${esc(src)}" alt="" />` : `<div class="admin-thumb ph"></div>`}
      <div class="meta"><strong>${esc(item.title || "未命名")}</strong><div class="muted">${esc(loc || item.city || "")}</div></div>
      ${btnHtml}
    </div>`;
  }
  async function paintCurrent() {
    const home = await api("/api/admin/homepage");
    const lamps = {};
    (home.approved_lamps || []).forEach((x) => { lamps[x.lamp_id] = x; });
    (home.pins || []).forEach((p) => { if (p.lamp) lamps[p.lamp.lamp_id] = p.lamp; });
    if ($("#adminFeedPins")) {
      $("#adminFeedPins").innerHTML = (home.feed_pins || []).map((fp) => {
        const item = Object.assign({}, lamps[fp.lamp_id] || {}, fp);
        return card(item, `<button class="btn danger" data-admin="feed-unpin" data-id="${esc(fp.lamp_id)}">取消</button>`);
      }).join("") || "<p class='muted'>暂无卡片置顶</p>";
    }
    if ($("#adminPins")) {
      $("#adminPins").innerHTML = (home.pins || []).map((p) => {
        const item = Object.assign({}, p.lamp || {}, { lamp_id: (p.lamp && p.lamp.lamp_id) || p.lamp_id });
        return card(item, `<button class="btn danger" data-admin="pin-del" data-id="${p.id}">移除</button>`);
      }).join("") || "<p class='muted'>暂无轮播</p>";
    }
    document.querySelectorAll(".hrs").forEach((el) => { el.placeholder = "有效小时，空=长期"; });
  }
  document.getElementById("btnRefresh")?.addEventListener("click", () => setTimeout(() => paintCurrent().catch(() => {}), 700));
  setTimeout(() => paintCurrent().catch(() => {}), 1800);
  if (!document.getElementById("yycj-admin-boot")) {
    const s = document.createElement("script");
    s.id = "yycj-admin-boot";
    s.src = "./admin-boot.js?v=20260911aq";
    document.head.appendChild(s);
  }
})();
