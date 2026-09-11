(() => {
  const token = () => localStorage.getItem("yycj_token") || "";
  function srcOf(u) {
    const s = String(u || "").trim();
    if (!s) return "";
    if (s.startsWith("blob:") || s.startsWith("http") || s.startsWith("/")) return s;
    if (s.startsWith("file_id:")) return srcOf(s.slice(8).trim());
    return "/api/media/file/" + encodeURIComponent(s);
  }
  function isVideo(m, raw) {
    const t = (m && m.type) || "";
    const u = String(raw || (m && (m.file_id || m.url)) || "");
    return t === "video" || u.startsWith("BAAC") || /\.(mp4|mov|webm|mkv)(\?|$)/i.test(u);
  }
  function stripIds(el) {
    el.querySelectorAll("p, li, span, pre, code").forEach((n) => {
      const t = (n.textContent || "").trim();
      if (/^file_id\s*:/i.test(t) || /^(AgACAg|BAACAg)/.test(t)) n.remove();
    });
  }
  async function paint(id) {
    const box = document.getElementById("detail");
    if (!box || !id || box.dataset.painted === id) return;
    try {
      const r = await fetch("/api/lamps/" + encodeURIComponent(id), {
        headers: { Authorization: "Bearer " + token() },
      });
      const data = await r.json();
      const lamp = data.lamp || data.item || data;
      const urls = [];
      (lamp.media || []).forEach((m) => {
        const raw = (m && (m.file_id || m.url || m.preview_url)) || "";
        const u = srcOf(m && (m.preview_url || m.file_id || m.url));
        if (u) urls.push({ type: isVideo(m, raw) ? "video" : "image", src: u });
      });
      if (!urls.length) (lamp.photos || []).forEach((p) => {
        const u = srcOf(p);
        if (u) urls.push({ type: isVideo({}, p) ? "video" : "image", src: u });
      });
      stripIds(box);
      let grid = box.querySelector(".media-grid");
      if (!grid) {
        grid = document.createElement("div");
        grid.className = "media-grid";
        const card = box.querySelector(".card") || box;
        card.insertBefore(grid, card.firstChild);
      }
      grid.innerHTML = urls.map((m) =>
        m.type === "video"
          ? `<video src="${m.src}" controls playsinline preload="metadata"></video>`
          : `<img src="${m.src}" alt="" />`
      ).join("");
      box.dataset.painted = id;
    } catch (e) {
      console.warn(e);
    }
  }
  document.addEventListener("click", (ev) => {
    const card = ev.target.closest("[data-id]");
    if (!card) return;
    const id = card.getAttribute("data-id");
    window.__lastLampId = id;
    const box = document.getElementById("detail");
    if (box) box.dataset.painted = "";
    setTimeout(() => paint(id), 350);
  });
})();
