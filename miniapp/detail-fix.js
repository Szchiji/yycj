(() => {
  const token = () => localStorage.getItem("yycj_token") || "";
  function srcOf(u) {
    const s = String(u || "").trim();
    if (!s) return "";
    if (s.startsWith("http") || s.startsWith("/")) return s;
    if (s.startsWith("file_id:")) return srcOf(s.slice(8).trim());
    return "/api/media/file/" + encodeURIComponent(s);
  }
  function stripFileIdText(el) {
    if (!el) return;
    el.querySelectorAll("p, div, li, span").forEach((n) => {
      const t = n.textContent || "";
      if (/file_id\s*:/i.test(t) || /AgACAg/.test(t)) n.remove();
    });
  }
  async function paint(id) {
    const box = document.getElementById("detail");
    if (!box || !id) return;
    try {
      const r = await fetch("/api/lamps/" + encodeURIComponent(id), {
        headers: { Authorization: "Bearer " + token() },
      });
      const data = await r.json();
      const lamp = data.lamp || data.item || data;
      const media = lamp.media || [];
      const photos = lamp.photos || [];
      const urls = [];
      media.forEach((m) => {
        const u = srcOf((m && (m.preview_url || m.file_id || m.url)) || "");
        if (u) urls.push({ type: (m && m.type) || "image", src: u });
      });
      if (!urls.length) photos.forEach((p) => { const u = srcOf(p); if (u) urls.push({ type: "image", src: u }); });
      stripFileIdText(box);
      let grid = box.querySelector(".media-grid");
      if (!grid) {
        grid = document.createElement("div");
        grid.className = "media-grid";
        box.insertBefore(grid, box.firstChild);
      }
      grid.innerHTML = urls.map((m) =>
        m.type === "video"
          ? `<video src="${m.src}" controls playsinline></video>`
          : `<img src="${m.src}" alt="" />`
      ).join("");
    } catch (e) {
      console.warn(e);
    }
  }
  document.addEventListener("click", (ev) => {
    const card = ev.target.closest("[data-id]");
    if (card) {
      window.__lastLampId = card.getAttribute("data-id");
      setTimeout(() => paint(window.__lastLampId), 300);
    }
  });
  const detail = document.getElementById("detail");
  if (detail) {
    new MutationObserver(() => {
      if (window.__lastLampId) paint(window.__lastLampId);
    }).observe(detail, { childList: true, subtree: true });
  }
})();
