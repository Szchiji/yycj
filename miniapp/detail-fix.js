(() => {
  const token = () => localStorage.getItem("yycj_token") || "";
  const cache = {};
  if (!document.getElementById("yycj-gallery-css")) {
    const st = document.createElement("style");
    st.id = "yycj-gallery-css";
    st.textContent = `
      #detail .media-grid { display:none !important; }
      #detail .gallery { margin:0 0 10px; }
      #detail .gallery-hero { position:relative; width:100%; border-radius:12px; overflow:hidden; background:#111; min-height:200px; }
      #detail .gallery-hero img, #detail .gallery-hero video {
        width:100%; max-height:320px; object-fit:cover; display:block;
      }
      #detail .gallery-hero .hero-poster { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; z-index:2; }
      #detail .gallery-hero.playing .hero-poster { display:none; }
      #detail .gallery-thumbs { display:flex; gap:6px; overflow-x:auto; margin-top:8px; }
      #detail .g-thumb {
        position:relative; flex:0 0 54px; width:54px; height:54px; padding:0;
        border:2px solid transparent; border-radius:8px; overflow:hidden; background:#111;
      }
      #detail .g-thumb.on { border-color:#7ea8ff; }
      #detail .g-thumb img { width:100%; height:100%; object-fit:cover; display:block; }
      #detail .g-thumb .play {
        position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
        color:#fff; background:rgba(0,0,0,.28); font-size:14px;
      }
    `;
    document.head.appendChild(st);
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
      const src = srcOf(m && (m.preview_url || m.file_id || m.url));
      if (src) out.push({ type: isVideo(m, raw) ? "video" : "image", src });
    });
    if (!out.length) (lamp.photos || []).forEach((p) => {
      const src = srcOf(p);
      if (src) out.push({ type: isVideo({}, p) ? "video" : "image", src });
    });
    const poster = (out.find((x) => x.type === "image") || {}).src || "";
    out.forEach((x) => { if (x.type === "video") x.poster = poster; });
    return out;
  }
  function hideNoise(box) {
    box.querySelectorAll(".media-grid").forEach((n) => { n.style.display = "none"; });
  }
  function playVideo(v, wrap) {
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    v.loop = true;
    v.autoplay = true;
    v.playsInline = true;
    v.setAttribute("playsinline", "");
    v.controls = false;
    const go = () => {
      v.play().then(() => wrap && wrap.classList.add("playing")).catch(() => {});
    };
    v.addEventListener("playing", () => wrap && wrap.classList.add("playing"));
    v.addEventListener("error", () => wrap && wrap.classList.remove("playing"));
    go();
    setTimeout(go, 300);
    setTimeout(go, 1200);
  }
  function renderGallery(box, items, lampId) {
    if (!box || !items.length) return;
    let wrap = box.querySelector(".gallery");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "gallery";
      const card = box.querySelector(".card") || box;
      card.insertBefore(wrap, card.firstChild);
    }
    let idx = Number(wrap.dataset.idx || -1);
    if (idx < 0 || idx >= items.length) {
      idx = items.findIndex((x) => x.type === "video" && x.poster);
      if (idx < 0) idx = items.findIndex((x) => x.type === "image");
      if (idx < 0) idx = 0;
    }
    const cur = items[idx] || items[0];
    const poster = cur.poster || (cur.type === "image" ? cur.src : "") || "";
    const hero = cur.type === "video"
      ? `${poster ? `<img class="hero-poster" src="${poster}" alt="" />` : ""}<video src="${cur.src}" poster="${poster}" muted autoplay loop playsinline webkit-playsinline></video>`
      : `<img src="${cur.src}" alt="" />`;
    wrap.innerHTML = `
      <div class="gallery-hero">${hero}</div>
      <div class="gallery-thumbs">${items.map((m, i) => `
        <button type="button" class="g-thumb${i === idx ? " on" : ""}" data-g="${i}">
          ${m.type === "video"
            ? `<img src="${m.poster || poster || ""}" alt="" /><span class="play">▶</span>`
            : `<img src="${m.src}" alt="" />`}
        </button>`).join("")}</div>`;
    wrap.dataset.idx = String(idx);
    wrap.dataset.lamp = lampId || "";
    wrap.querySelectorAll("[data-g]").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        wrap.dataset.idx = btn.getAttribute("data-g") || "0";
        renderGallery(box, items, lampId);
      });
    });
    const heroWrap = wrap.querySelector(".gallery-hero");
    const v = wrap.querySelector(".gallery-hero video");
    if (v) playVideo(v, heroWrap);
    hideNoise(box);
  }
  async function paint(id) {
    const box = document.getElementById("detail");
    if (!box || !id) return;
    try {
      if (!cache[id]) {
        const r = await fetch("/api/lamps/" + encodeURIComponent(id), {
          headers: { Authorization: "Bearer " + token() },
        });
        cache[id] = await r.json();
      }
      renderGallery(box, collect(cache[id].lamp || cache[id].item || cache[id]), id);
    } catch (e) { console.warn(e); }
  }
  window.openLamp = function (id) {
    window.__yycjBack = window.__yycjBack || "home";
    document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
    document.getElementById("view-detail")?.classList.remove("hidden");
    const g = document.querySelector("#detail .gallery");
    if (g) { g.dataset.idx = "-1"; }
    paint(id);
  };
  document.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-share],[data-fav],[data-unfav]")) return;
    const card = ev.target.closest("[data-id]");
    if (!card) return;
    const g = document.querySelector("#detail .gallery");
    if (g) g.dataset.idx = "-1";
    paint(card.getAttribute("data-id"));
  });
})();
