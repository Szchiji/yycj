(() => {
  const token = () => localStorage.getItem("yycj_token") || "";
  const cache = {};
  if (!document.getElementById("yycj-gallery-css")) {
    const st = document.createElement("style");
    st.id = "yycj-gallery-css";
    st.textContent = `
      #detail .media-grid { display:none !important; }
      #yycjGallery { margin:8px 0 10px; }
      #yycjGallery .gallery-hero { width:100%; border-radius:12px; overflow:hidden; background:#111; min-height:180px; }
      #yycjGallery .gallery-hero img, #yycjGallery .gallery-hero video {
        width:100%; max-height:320px; object-fit:contain; background:#111; display:block;
      }
      #yycjGallery .gallery-thumbs { display:flex; gap:6px; overflow-x:auto; margin-top:8px; }
      #yycjGallery .g-thumb {
        position:relative; flex:0 0 54px; width:54px; height:54px; padding:0;
        border:2px solid transparent; border-radius:8px; overflow:hidden; background:#111;
      }
      #yycjGallery .g-thumb.on { border-color:#7ea8ff; }
      #yycjGallery .g-thumb img, #yycjGallery .g-thumb video { width:100%; height:100%; object-fit:cover; display:block; }
      #yycjGallery .g-thumb .play {
        position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
        color:#fff; background:rgba(0,0,0,.3); font-size:13px;
      }
    `;
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
      const raw = (m && (m.file_id || m.url)) || "";
      const src = srcOf(m && (m.file_id || m.url || m.preview_url));
      if (!src) return;
      const vid = isVideo(m, raw);
      out.push({ type: vid ? "video" : "image", src, poster: srcOf(m && (m.thumb_file_id || m.thumbnail || "")) });
    });
    if (!out.length) (lamp.photos || []).forEach((p) => {
      const src = srcOf(p);
      if (src) out.push({ type: isVideo({}, p) ? "video" : "image", src, poster: "" });
    });
    return out;
  }
  function playHero(v) {
    if (!v) return;
    v.muted = true;
    v.loop = true;
    v.autoplay = true;
    v.playsInline = true;
    v.controls = false;
    const go = () => v.play().catch(() => {});
    go();
    v.addEventListener("canplay", go, { once: true });
  }
  function snap(v) {
    if (!v) return;
    v.muted = true;
    v.playsInline = true;
    const go = () => { try { v.currentTime = 0.15; } catch (e) {} };
    v.addEventListener("loadeddata", go);
  }
  function ensureShare() {
    const box = document.getElementById("detail");
    if (!box) return;
    let btn = document.getElementById("detailShare");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "detailShare";
      btn.className = "btn";
      btn.type = "button";
      btn.textContent = "分享";
    }
    btn.setAttribute("data-share", box.getAttribute("data-lamp") || "1");
    const row = box.querySelector("#detailChat")?.parentElement || box.querySelector(".row");
    if (row && btn.parentElement !== row) row.appendChild(btn);
  }
  function render(items, lampId, idx) {
    const el = host();
    if (!el || !items.length) return;
    if (idx < 0 || idx >= items.length) idx = 0;
    const cur = items[idx];
    el.dataset.lamp = lampId || "";
    el.dataset.idx = String(idx);
    el.innerHTML = `<div class="gallery-hero">${cur.type === "video"
      ? `<video src="${cur.src}" ${cur.poster ? `poster="${cur.poster}"` : ""} muted autoplay loop playsinline></video>`
      : `<img src="${cur.src}" alt="" />`}</div>
      <div class="gallery-thumbs">${items.map((m, i) => `<button type="button" class="g-thumb${i === idx ? " on" : ""}" data-g="${i}">${
        m.type === "video"
          ? (m.poster ? `<img src="${m.poster}" alt="" />` : `<video src="${m.src}" muted preload="auto" playsinline></video>`) + `<span class="play">▶</span>`
          : `<img src="${m.src}" alt="" />`
      }</button>`).join("")}</div>`;
    el.querySelectorAll("[data-g]").forEach((btn) => {
      btn.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        render(items, lampId, Number(btn.getAttribute("data-g") || 0));
      };
    });
    el.querySelectorAll(".g-thumb video").forEach(snap);
    if (cur.type === "video") playHero(el.querySelector(".gallery-hero video"));
    document.querySelectorAll("#detail .media-grid").forEach((n) => { n.style.display = "none"; });
    ensureShare();
  }
  async function paint(id) {
    if (!id) return;
    const box = document.getElementById("detail");
    if (box) box.setAttribute("data-lamp", id);
    try {
      if (!cache[id]) {
        const r = await fetch("/api/lamps/" + encodeURIComponent(id), {
          headers: { Authorization: "Bearer " + token() },
        });
        cache[id] = await r.json();
      }
      const items = collect(cache[id].lamp || cache[id].item || cache[id]);
      render(items, id, 0);
    } catch (e) { console.warn(e); }
  }
  window.openLamp = function (id) {
    window.__yycjBack = window.__yycjBack || "home";
    document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
    document.getElementById("view-detail")?.classList.remove("hidden");
    paint(id);
  };
  document.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-share],[data-fav],[data-unfav],#detailShare,#yycjGallery")) return;
    const card = ev.target.closest("#feed [data-id], #pins [data-id], #favList [data-id]");
    if (!card) return;
    paint(card.getAttribute("data-id"));
  });
})();
