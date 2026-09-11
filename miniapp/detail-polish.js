(() => {
  const pre = {};
  function srcOf(u) {
    const s = String(u || "").trim();
    if (!s) return "";
    if (s.toLowerCase().startsWith("file_id:")) return srcOf(s.slice(8));
    if (s.startsWith("http") || s.startsWith("/")) return s;
    return "/api/media/file/" + encodeURIComponent(s);
  }
  function isVid(m, raw) {
    const t = (m && m.type) || "";
    const u = String(raw || (m && (m.file_id || m.url)) || "");
    return t === "video" || u.startsWith("BAAC") || u.startsWith("BQAC") || /\.(mp4|mov|webm)(\?|$)/i.test(u);
  }
  function prefetch(url) {
    if (!url || pre[url]) return;
    pre[url] = true;
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;
    v.src = url;
    v.load();
  }
  function firstVideo(lamp) {
    for (const m of lamp.media || []) {
      const raw = (m && (m.file_id || m.url)) || "";
      if (isVid(m, raw)) return srcOf(m.file_id || m.url);
    }
    for (const p of lamp.photos || []) {
      if (isVid({}, p)) return srcOf(p);
    }
    return "";
  }
  function tune(v) {
    if (!v || v.dataset.tuned) return;
    v.dataset.tuned = "1";
    v.muted = true;
    v.defaultMuted = true;
    v.autoplay = true;
    v.loop = true;
    v.controls = false;
    v.playsInline = true;
    v.preload = "auto";
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "");
    v.setAttribute("muted", "");
    const go = () => v.play().catch(() => {});
    go();
    v.addEventListener("loadeddata", go);
    v.addEventListener("canplay", go);
  }
  function dedupe() {
    document.querySelectorAll("#detail .muted").forEach((el) => {
      const parts = (el.textContent || "").split("·").map((s) => s.trim()).filter(Boolean);
      const seen = new Set();
      const out = [];
      parts.forEach((p) => { if (!seen.has(p)) { seen.add(p); out.push(p); } });
      const next = out.join(" · ");
      if (next && next !== el.textContent.trim()) el.textContent = next;
    });
  }
  document.addEventListener("click", (ev) => {
    const card = ev.target.closest("#feed [data-id], #pins [data-id], #favList [data-id]");
    if (!card) return;
    const id = card.getAttribute("data-id");
    if (!id) return;
    fetch("/api/lamps/" + encodeURIComponent(id), {
      headers: { Authorization: "Bearer " + (localStorage.getItem("yycj_token") || "") },
    }).then((r) => r.json()).then((data) => {
      const lamp = data.lamp || data.item || data;
      const url = firstVideo(lamp || {});
      if (url) prefetch(url);
    }).catch(() => {});
  }, true);
  const tick = () => {
    dedupe();
    document.querySelectorAll("#yycjGallery video, #detail video").forEach(tune);
    document.querySelectorAll("#detail .media-grid").forEach((n) => { n.style.display = "none"; });
  };
  const view = document.getElementById("view-detail");
  if (view) new MutationObserver(tick).observe(view, { childList: true, subtree: true });
  setInterval(tick, 600);
})();
