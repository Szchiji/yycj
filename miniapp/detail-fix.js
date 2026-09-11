(() => {
  const token = () => localStorage.getItem("yycj_token") || "";
  const cache = {};
  if (!document.getElementById("yycj-gallery-css")) {
    const st = document.createElement("style");
    st.id = "yycj-gallery-css";
    st.textContent = `
      #detail .media-grid { display: none !important; }
      #detail .gallery { margin: 0 0 10px; }
      #detail .gallery-hero { width: 100%; border-radius: 12px; overflow: hidden; background: #111; }
      #detail .gallery-hero img, #detail .gallery-hero video {
        width: 100%; max-height: 320px; object-fit: cover; display: block;
      }
      #detail .gallery-thumbs { display: flex; gap: 6px; overflow-x: auto; margin-top: 8px; }
      #detail .g-thumb {
        position: relative; flex: 0 0 54px; width: 54px; height: 54px; padding: 0;
        border: 2px solid transparent; border-radius: 8px; overflow: hidden; background: #111;
      }
      #detail .g-thumb.on { border-color: #7ea8ff; }
      #detail .g-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
      #detail .g-thumb .play {
        position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
        color: #fff; background: rgba(0,0,0,.35); font-size: 14px;
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
    return t === "video" || u.startsWith("BAAC") || /\.(mp4|mov|webm|mkv)(\?|$)/i.test(u);
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
    return out;
  }
  function hideNoise(box) {
    box.querySelectorAll(".media-grid").forEach((n) => { n.style.display = "none"; });
    box.querySelectorAll("p, li, span, pre, code, div").forEach((n) => {
      if (n.closest(".gallery")) return;
      const t = (n.textContent || "").replace(/\s+/g, " ").trim();
      if (/^file_id:?$/i.test(t) || /^file_id\s*:/i.test(t) || /^(AgACAg|BAACAg)/.test(t)) n.style.display = "none";
      if (t.includes("·")) {
        const parts = t.split("·").map((s) => s.replace(/[\s📍📌]/g, "").trim()).filter(Boolean);
        const uniq = [];
        parts.forEach((p) => { if (p && !uniq.includes(p)) uniq.push(p); });
        if (uniq.length && uniq.length < parts.length) n.textContent = uniq.join(" · ");
      }
    });
  }
  function goFull(video) {
    if (!video) return;
    video.play().catch(() => {});
    const req = video.requestFullscreen || video.webkitRequestFullscreen || video.webkitEnterFullscreen;
    if (req) { try { req.call(video); } catch (e) {} }
  }
  function renderGallery(box, items, force) {
    if (!box || !items.length) return;
    let wrap = box.querySelector(".gallery");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "gallery";
      const card = box.querySelector(".card") || box;
      card.insertBefore(wrap, card.firstChild);
    }
    if (!force && wrap.dataset.ready === "1" && wrap.querySelector(".gallery-hero")) {
      hideNoise(box);
      return;
    }
    let idx = Number(wrap.dataset.idx || -1);
    if (idx < 0) {
      idx = items.findIndex((x) => x.type !== "video");
      if (idx < 0) idx = 0;
    }
    const cur = items[idx] || items[0];
    wrap.innerHTML = `
      <div class="gallery-hero">${cur.type === "video"
        ? `<video src="${cur.src}" controls playsinline webkit-playsinline></video>`
        : `<img src="${cur.src}" alt="" decoding="async" />`}</div>
      <div class="gallery-thumbs">${items.map((m, i) => `
        <button type="button" class="g-thumb${i === idx ? " on" : ""}" data-g="${i}">
          ${m.type === "video"
            ? `<span class="play">▶</span>`
            : `<img data-src="${m.src}" src="${m.src}" alt="" loading="lazy" decoding="async" />`}
        </button>`).join("")}</div>`;
    wrap.dataset.idx = String(idx);
    wrap.dataset.ready = "1";
    wrap.querySelectorAll("[data-g]").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        wrap.dataset.ready = "0";
        wrap.dataset.idx = btn.getAttribute("data-g") || "0";
        renderGallery(box, items, true);
        const v = wrap.querySelector(".gallery-hero video");
        if (v) goFull(v);
      });
    });
    const heroVid = wrap.querySelector(".gallery-hero video");
    if (heroVid) heroVid.addEventListener("click", () => goFull(heroVid));
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
      const data = cache[id];
      renderGallery(box, collect(data.lamp || data.item || data), false);
    } catch (e) { console.warn(e); }
  }
  window.openLamp = function (id) {
    window.__yycjBack = window.__yycjBack || "home";
    document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
    document.getElementById("view-detail")?.classList.remove("hidden");
    const g = document.querySelector("#detail .gallery");
    if (g) { g.dataset.ready = "0"; g.dataset.idx = "-1"; }
    paint(id);
  };
  document.addEventListener("click", (ev) => {
    const card = ev.target.closest("[data-id]");
    if (!card || ev.target.closest("[data-fav],[data-unfav]")) return;
    const id = card.getAttribute("data-id");
    const g = document.querySelector("#detail .gallery");
    if (g) { g.dataset.ready = "0"; g.dataset.idx = "-1"; }
    paint(id);
  });
  const box = document.getElementById("detail");
  if (box) {
    new MutationObserver(() => {
      const id = box.getAttribute("data-lamp") || (document.querySelector("#view-detail:not(.hidden)") && Object.keys(cache).slice(-1)[0]);
      if (id && !box.querySelector(".gallery-hero")) paint(id);
      hideNoise(box);
    }).observe(box, { childList: true, subtree: true });
  }
})();
