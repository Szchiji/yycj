(() => {
  const token = () => localStorage.getItem("yycj_token") || "";
  window.__yycjLampCache = window.__yycjLampCache || {};
  if (!document.getElementById("yycj-gallery-css")) {
    const st = document.createElement("style");
    st.id = "yycj-gallery-css";
    st.textContent = `#detail .media-grid{display:none!important;}#yycjGallery{margin:8px 0 10px;}#yycjGallery .gallery-hero{width:100%;border-radius:12px;overflow:hidden;background:#111;min-height:180px;position:relative;}#yycjGallery .gallery-hero img,#yycjGallery .gallery-hero video{width:100%;max-height:320px;object-fit:contain;background:#111;display:block;}#yycjGallery .gallery-thumbs{display:flex;gap:6px;overflow-x:auto;margin-top:8px;}#yycjGallery .g-thumb{position:relative;flex:0 0 54px;width:54px;height:54px;padding:0;border:2px solid transparent;border-radius:8px;overflow:hidden;background:#1a2233;}#yycjGallery .g-thumb.on{border-color:#7ea8ff;}#yycjGallery .g-thumb img{width:100%;height:100%;object-fit:cover;display:block;background:#1a2233;}#yycjGallery .g-thumb .play,#yycjGallery .hero-play{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;background:rgba(0,0,0,.28);font-size:18px;pointer-events:none;}`;
    document.head.appendChild(st);
  }
  function host() {
    const view = document.getElementById("view-detail");
    if (!view) return null;
    let el = document.getElementById("yycjGallery");
    if (!el) {
      el = document.createElement("div");
      el.id = "yycjGallery";
      const detail = document.getElementById("detail");
      if (detail) view.insertBefore(el, detail);
      else view.appendChild(el);
    }
    return el;
  }
  function srcOf(u) {
    const s = String(u || "").trim();
    if (!s) return "";
    if (s.toLowerCase().startsWith("file_id:")) return srcOf(s.slice(8).trim());
    if (s.startsWith("http") || s.startsWith("/")) return s;
    return "/api/media/file/" + encodeURIComponent(s);
  }
  function isVideo(m, raw) {
    const t = (m && m.type) || "";
    const u = String(raw || (m && (m.file_id || m.url)) || "");
    return t === "video" || u.startsWith("BAAC") || u.startsWith("BQAC") || /\.(mp4|mov|webm|mkv)(\?|$)/i.test(u);
  }
  function collect(lamp) {
    const out = [];
    (lamp.media || []).forEach((m) => {
      const raw = String((m && (m.file_id || m.url)) || "").trim();
      const src = srcOf(raw);
      if (!src) return;
      const vid = isVideo(m, raw);
      let poster = srcOf(m && (m.thumb_file_id || m.thumbnail || m.preview_url || ""));
      if (poster && isVideo({}, poster)) poster = "";
      out.push({ type: vid ? "video" : "image", src, poster, raw });
    });
    if (!out.length) (lamp.photos || []).forEach((p) => {
      const src = srcOf(p);
      if (src) out.push({ type: isVideo({}, p) ? "video" : "image", src, poster: "", raw: p });
    });
    return out;
  }
  function render(items, lampId, idx, play) {
    const el = host();
    if (!el || !items.length) return;
    if (idx < 0 || idx >= items.length) idx = 0;
    const cur = items[idx];
    el.dataset.lamp = lampId || "";
    const poster = cur.poster || "";
    let hero;
    if (cur.type === "video" && play) {
      hero = `<video src="${cur.src}" ${poster ? `poster="${poster}"` : ""} playsinline controls preload="metadata"></video>`;
    } else if (cur.type === "video") {
      hero = `${poster ? `<img src="${poster}" alt="" />` : `<div style="height:220px;background:#111"></div>`}<span class="hero-play">▶</span>`;
    } else {
      hero = `<img src="${cur.src}" alt="" />`;
    }
    el.innerHTML = `<div class="gallery-hero" data-play="${cur.type === "video" ? "1" : "0"}">${hero}</div>
      <div class="gallery-thumbs">${items.map((m, i) => `<button type="button" class="g-thumb${i === idx ? " on" : ""}" data-g="${i}">${
        m.type === "video"
          ? `${m.poster ? `<img src="${m.poster}" alt="" />` : ""}<span class="play">▶</span>`
          : `<img src="${m.src}" alt="" />`
      }</button>`).join("")}</div>`;
    el.querySelectorAll("[data-g]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        const n = Number(btn.getAttribute("data-g") || 0);
        render(items, lampId, n, items[n] && items[n].type === "video");
      };
    });
    const heroBox = el.querySelector(".gallery-hero");
    if (heroBox && cur.type === "video" && !play) {
      heroBox.onclick = (ev) => { ev.preventDefault(); render(items, lampId, idx, true); };
    }
    document.querySelectorAll("#detail .media-grid").forEach((n) => { n.style.display = "none"; });
  }
  async function paint(id) {
    if (!id) return;
    const box = document.getElementById("detail");
    if (box) box.setAttribute("data-lamp", id);
    if (window.__yycjLampCache[id] && window.__yycjLampCache[id].lamp) {
      render(collect(window.__yycjLampCache[id].lamp), id, 0, false);
    }
    try {
      const r = await fetch("/api/lamps/" + encodeURIComponent(id), {
        headers: { Authorization: "Bearer " + token() },
      });
      const data = await r.json();
      window.__yycjLampCache[id] = data;
      render(collect(data.lamp || data.item || data), id, 0, false);
    } catch (e) { console.warn(e); }
  }
  window.openLamp = function (id) {
    window.__yycjBack = window.__yycjBack || "home";
    document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
    document.getElementById("view-detail")?.classList.remove("hidden");
    paint(id);
  };
  document.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-share],[data-fav],[data-unfav],#detailShare,a")) return;
    const card = ev.target.closest("#feed [data-id], #pins [data-id], #favList [data-id]");
    if (!card) return;
    ev.preventDefault();
    window.openLamp(card.getAttribute("data-id"));
  });
})();
