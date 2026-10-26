(() => {
  if (window.__yycjDetailFix) return;
  window.__yycjDetailFix = true;
  const token = () => localStorage.getItem("yycj_token") || "";
  window.__yycjLampCache = window.__yycjLampCache || {};
  if (!document.getElementById("yycj-gallery-css")) {
    const st = document.createElement("style");
    st.id = "yycj-gallery-css";
    st.textContent = `#detail .media-grid{display:none!important;}#yycjGallery{margin:8px 0 10px;position:relative;}
#yycjGallery .yc-track{display:flex;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;overscroll-behavior-x:contain;scrollbar-width:none;border-radius:12px;background:#111;touch-action:pan-x pan-y;}
#yycjGallery .yc-track::-webkit-scrollbar{display:none;}
#yycjGallery .yc-slide{position:relative;flex:0 0 100%;width:100%;height:min(calc(100vw - 24px),60vh);scroll-snap-align:center;scroll-snap-stop:always;padding:0;margin:0;border:0;background:#111;display:block;overflow:hidden;-webkit-appearance:none;appearance:none;-webkit-tap-highlight-color:transparent;}
#yycjGallery .yc-slide img{width:100%;height:100%;object-fit:contain;display:block;background:#111;-webkit-user-drag:none;user-select:none;}
#yycjGallery .yc-play{position:absolute;left:50%;top:50%;width:56px;height:56px;margin:-28px 0 0 -28px;border-radius:28px;display:flex;align-items:center;justify-content:center;color:#fff;background:rgba(0,0,0,.45);font-size:22px;pointer-events:none;}
#yycjGallery .yc-count{position:absolute;top:10px;right:10px;padding:3px 9px;border-radius:12px;background:rgba(0,0,0,.5);color:#fff;font-size:12px;line-height:18px;pointer-events:none;}
#yycjGallery .yc-dots{display:flex;justify-content:center;gap:6px;margin-top:8px;height:6px;}
#yycjGallery .yc-dot{width:6px;height:6px;border-radius:3px;background:rgba(255,255,255,.25);transition:width .2s,background .2s;}
#yycjGallery .yc-dot.on{width:16px;background:#7ea8ff;}`;
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
      let poster = srcOf(m && (m.thumb_file_id || m.thumbnail || ""));
      if (poster && isVideo({}, poster)) poster = "";
      if (vid && !poster && raw && !raw.startsWith("http")) poster = "/api/media/poster/" + encodeURIComponent(raw);
      out.push({ type: vid ? "video" : "image", src, poster, raw });
    });
    if (!out.length) (lamp.photos || []).forEach((p) => {
      const src = srcOf(p);
      if (src) out.push({ type: isVideo({}, p) ? "video" : "image", src, poster: "", raw: p });
    });
    return out;
  }
  function esc(t) {
    return String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":"&#39;" }[c]));
  }
  function thumbHtml(m, i, idx) {
    return `<button type="button" class="g-thumb${i === idx ? " on" : ""}" data-g="${i}">${
      m.type === "video"
        ? `${m.poster ? `<img src="${esc(m.poster)}" alt="" />` : ""}<span class="play">▶</span>`
        : `<img src="${esc(m.src)}" alt="" />`
    }</button>`;
  }
  // Scroll only the strip (never the page) so the chosen thumb is fully visible.
  function revealThumb(strip, btn, smooth) {
    if (!strip || !btn) return;
    const left = btn.offsetLeft - strip.offsetLeft;
    const target = Math.max(0, left - (strip.clientWidth - btn.offsetWidth) / 2);
    if (strip.scrollTo) strip.scrollTo({ left: target, behavior: smooth ? "smooth" : "auto" });
    else strip.scrollLeft = target;
  }
  // Inline carousel: one large item per view, swipe horizontally (scroll-snap).
  // Videos only show a poster here; they load/play in the full-screen viewer.
  function slideHtml(m, i) {
    const lazy = i > 1 ? ` loading="lazy"` : "";
    const inner = m.type === "video"
      ? `${m.poster ? `<img src="${esc(m.poster)}" alt=""${lazy} decoding="async" draggable="false" />` : ""}<span class="yc-play">▶</span>`
      : `<img src="${esc(m.src)}" alt=""${lazy} decoding="async" draggable="false" />`;
    return `<button type="button" class="yc-slide" data-i="${i}" data-type="${m.type}" aria-label="${m.type === "video" ? "播放视频" : "查看图片"} ${i + 1}">${inner}</button>`;
  }
  function setIdx(el, idx, n) {
    el.dataset.idx = String(idx);
    const c = el.querySelector(".yc-count");
    if (c) c.textContent = `${idx + 1}/${n}`;
    el.querySelectorAll(".yc-dot").forEach((d, k) => d.classList.toggle("on", k === idx));
  }
  function goSlide(el, idx, n) {
    const track = el.querySelector(".yc-track");
    if (!track) return;
    track.scrollLeft = idx * track.clientWidth;
    setIdx(el, idx, n);
  }
  function render(items, lampId, idx) {
    const el = host();
    if (!el || !items.length) return;
    if (idx < 0 || idx >= items.length) idx = 0;
    const n = items.length;
    el.dataset.lamp = lampId || "";
    el.dataset.idx = String(idx);
    el.innerHTML = `<div class="yc-track">${items.map(slideHtml).join("")}</div>${
      n > 1 ? `<span class="yc-count">${idx + 1}/${n}</span>` : ""}${
      n > 1 && n <= 12 ? `<div class="yc-dots">${items.map((_, k) => `<span class="yc-dot${k === idx ? " on" : ""}"></span>`).join("")}</div>` : ""}`;
    // Height follows the first item's aspect ratio (clamped 3:4 portrait .. 4:3 landscape).
    const first = el.querySelector(".yc-slide img");
    const fit = () => { if (first && first.naturalWidth) el.style.setProperty("--yc-r", Math.max(0.75, Math.min(4 / 3, first.naturalHeight / first.naturalWidth)).toFixed(4)); };
    if (first) { if (first.complete) fit(); else first.addEventListener("load", fit, { once: true }); }
    const track = el.querySelector(".yc-track");
    let t = 0;
    track.addEventListener("scroll", () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const w = track.clientWidth || 1;
        const k = Math.max(0, Math.min(n - 1, Math.round(track.scrollLeft / w)));
        if (String(k) !== el.dataset.idx) setIdx(el, k, n);
      }, 60);
    }, { passive: true });
    el.onclick = (ev) => {
      const sl = ev.target.closest(".yc-slide");
      if (!sl || !el.contains(sl)) return;
      ev.preventDefault();
      ev.stopPropagation();
      const k = Number(sl.getAttribute("data-i") || 0);
      openViewer(items, k, (m) => goSlide(el, m, n));
    };
    if (idx) goSlide(el, idx, n);
    document.querySelectorAll("#detail .media-grid").forEach((x) => { x.style.display = "none"; });
  }

  // ---- Full-screen viewer: fixed overlay, background locked, swipe between media,
  // ---- only the visible video gets a src (preload=metadata), others are paused/unloaded.
  if (!document.getElementById("yycj-viewer-css")) {
    const st = document.createElement("style");
    st.id = "yycj-viewer-css";
    st.textContent = `#yycjViewer{position:fixed;inset:0;z-index:1000;background:#000;display:flex;flex-direction:column;overscroll-behavior:contain;touch-action:pan-x;}
#yycjViewer .yv-top{display:flex;justify-content:space-between;align-items:center;padding:calc(8px + env(safe-area-inset-top)) 12px 8px;color:#fff;font-size:14px;}
#yycjViewer .yv-close{width:36px;height:36px;border-radius:18px;border:0;background:rgba(255,255,255,.14);color:#fff;font-size:18px;}
#yycjViewer .yv-track{flex:1;display:flex;overflow-x:auto;overflow-y:hidden;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;scrollbar-width:none;}
#yycjViewer .yv-track::-webkit-scrollbar{display:none;}
#yycjViewer .yv-slide{flex:0 0 100%;width:100%;height:100%;scroll-snap-align:center;scroll-snap-stop:always;display:flex;align-items:center;justify-content:center;}
#yycjViewer .yv-slide img{width:100%;height:100%;object-fit:contain;background:#000;}#yycjViewer .yv-slide video{max-width:100%;max-height:100%;object-fit:contain;background:#000;}
#yycjViewer .yv-nav{position:absolute;top:50%;transform:translateY(-50%);width:40px;height:56px;border:0;border-radius:10px;background:rgba(255,255,255,.12);color:#fff;font-size:24px;}
#yycjViewer .yv-prev{left:6px;}#yycjViewer .yv-next{right:6px;}
#yycjViewer .yv-thumbs{display:flex;gap:6px;overflow-x:auto;padding:8px 10px calc(10px + env(safe-area-inset-bottom));overscroll-behavior:contain;scrollbar-width:none;}
#yycjViewer .yv-thumbs::-webkit-scrollbar{display:none;}
#yycjViewer .g-thumb{position:relative;flex:0 0 54px;width:54px;height:54px;padding:0;border:2px solid transparent;border-radius:8px;overflow:hidden;background:#1a2233;}
#yycjViewer .g-thumb.on{border-color:#7ea8ff;}
#yycjViewer .g-thumb img{width:100%;height:100%;object-fit:cover;display:block;}
#yycjViewer .g-thumb .play{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;background:rgba(0,0,0,.28);font-size:18px;pointer-events:none;}
html.yv-lock,html.yv-lock body{overscroll-behavior:none;}`;
    document.head.appendChild(st);
  }
  let lockY = 0;
  let swipesOff = false;
  function lockPage() {
    lockY = window.scrollY || document.documentElement.scrollTop || 0;
    const b = document.body;
    b.dataset.yvPrev = JSON.stringify({ position: b.style.position, top: b.style.top, left: b.style.left, right: b.style.right, width: b.style.width, overflow: b.style.overflow });
    b.style.position = "fixed";
    b.style.top = -lockY + "px";
    b.style.left = "0";
    b.style.right = "0";
    b.style.width = "100%";
    b.style.overflow = "hidden";
    document.documentElement.classList.add("yv-lock");
    const tg = window.Telegram && window.Telegram.WebApp;
    try {
      if (tg && tg.disableVerticalSwipes && tg.isVerticalSwipesEnabled !== false) { tg.disableVerticalSwipes(); swipesOff = true; }
    } catch (e) {}
  }
  function unlockPage() {
    const b = document.body;
    let prev = {};
    try { prev = JSON.parse(b.dataset.yvPrev || "{}"); } catch (e) {}
    ["position", "top", "left", "right", "width", "overflow"].forEach((k) => { b.style[k] = prev[k] || ""; });
    delete b.dataset.yvPrev;
    document.documentElement.classList.remove("yv-lock");
    window.scrollTo(0, lockY);
    const tg = window.Telegram && window.Telegram.WebApp;
    try { if (swipesOff && tg && tg.enableVerticalSwipes) tg.enableVerticalSwipes(); } catch (e) {}
    swipesOff = false;
  }
  function openViewer(items, start, onClose) {
    closeViewer();
    const ov = document.createElement("div");
    ov.id = "yycjViewer";
    ov.setAttribute("role", "dialog");
    ov.innerHTML = `<div class="yv-top"><span class="yv-count"></span><button type="button" class="yv-close" aria-label="关闭">✕</button></div>
      <div class="yv-track">${items.map((m, i) => `<div class="yv-slide" data-i="${i}">${
        m.type === "video"
          ? `<video playsinline webkit-playsinline controls preload="none"${m.poster ? ` poster="${esc(m.poster)}"` : ""}></video>`
          : `<img src="${esc(m.src)}" alt="" decoding="async" />`
      }</div>`).join("")}</div>
      ${items.length > 1 ? `<button type="button" class="yv-nav yv-prev" aria-label="上一个">‹</button><button type="button" class="yv-nav yv-next" aria-label="下一个">›</button>` : ""}
      <div class="yv-thumbs">${items.map((m, i) => thumbHtml(m, i, start)).join("")}</div>`;
    document.body.appendChild(ov);
    lockPage();
    const track = ov.querySelector(".yv-track");
    const strip = ov.querySelector(".yv-thumbs");
    let cur = -1;
    function activate(i, autoplay) {
      if (i < 0 || i >= items.length) return;
      const changed = i !== cur;
      cur = i;
      ov.dataset.idx = String(i);
      ov.querySelector(".yv-count").textContent = `${i + 1} / ${items.length}`;
      ov.querySelectorAll(".yv-slide video").forEach((v) => {
        const slide = Number(v.parentNode.getAttribute("data-i"));
        if (slide !== i && v.getAttribute("src")) {
          v.pause();
          v.removeAttribute("src");
          try { v.load(); } catch (e) {}
        }
      });
      const m = items[i];
      if (m.type === "video") {
        const v = ov.querySelector(`.yv-slide[data-i="${i}"] video`);
        if (v && !v.getAttribute("src")) {
          v.preload = "metadata";
          v.src = m.src;
        }
        if (v && autoplay) v.play().catch(() => {});
      }
      if (changed) {
        strip.querySelectorAll(".g-thumb").forEach((b, k) => b.classList.toggle("on", k === i));
        revealThumb(strip, strip.querySelector(`.g-thumb[data-g="${i}"]`), true);
      }
    }
    function go(i, autoplay) {
      if (i < 0 || i >= items.length) return;
      track.scrollTo({ left: i * track.clientWidth, behavior: "auto" });
      activate(i, autoplay);
    }
    let t = 0;
    track.addEventListener("scroll", () => {
      clearTimeout(t);
      t = setTimeout(() => {
        const w = track.clientWidth || 1;
        activate(Math.round(track.scrollLeft / w), false);
      }, 90);
    }, { passive: true });
    ov.addEventListener("click", (ev) => {
      const th = ev.target.closest(".g-thumb");
      if (th) { ev.preventDefault(); go(Number(th.getAttribute("data-g") || 0), true); return; }
      if (ev.target.closest(".yv-prev")) { go(cur - 1, false); return; }
      if (ev.target.closest(".yv-next")) { go(cur + 1, false); return; }
      if (ev.target.closest(".yv-close")) { closeViewer(); return; }
    });
    ov._onClose = () => { if (onClose && cur >= 0) onClose(cur); };
    ov._onKey = (ev) => {
      if (ev.key === "Escape") closeViewer();
      else if (ev.key === "ArrowLeft") go(cur - 1, false);
      else if (ev.key === "ArrowRight") go(cur + 1, false);
    };
    document.addEventListener("keydown", ov._onKey);
    track.scrollLeft = start * track.clientWidth;
    activate(start, true);
    revealThumb(strip, strip.querySelector(`.g-thumb[data-g="${start}"]`), false);
  }
  function closeViewer() {
    const ov = document.getElementById("yycjViewer");
    if (!ov) return;
    ov.querySelectorAll("video").forEach((v) => { try { v.pause(); v.removeAttribute("src"); v.load(); } catch (e) {} });
    document.removeEventListener("keydown", ov._onKey);
    const cb = ov._onClose;
    window.__yycjViewerClosedAt = Date.now();
    ov.remove();
    unlockPage();
    if (cb) cb();
  }
  window.__yycjCloseViewer = closeViewer;
  try {
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.onEvent) tg.onEvent("backButtonClicked", closeViewer);
  } catch (e) {}
  window.addEventListener("popstate", closeViewer);
  async function paint(id) {
    if (!id) return;
    const box = document.getElementById("detail");
    if (box) box.setAttribute("data-lamp", id);
    try {
      const r = await fetch("/api/lamps/" + encodeURIComponent(id), {
        headers: { Authorization: "Bearer " + token() },
        cache: "no-store",
      });
      const data = await r.json();
      window.__yycjLampCache[id] = data;
      render(collect(data.lamp || data.item || data), id, 0);
    } catch (e) { console.warn(e); }
  }
  window.openLamp = function (id) {
    closeViewer();
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
