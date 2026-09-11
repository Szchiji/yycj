(() => {
  const token = () => localStorage.getItem("yycj_token") || "";
  function srcOf(u) {
    const s = String(u || "").trim();
    if (!s) return "";
    if (s.startsWith("http") || s.startsWith("/") || s.startsWith("blob:")) return s;
    if (s.toLowerCase().startsWith("file_id:")) return srcOf(s.slice(8).trim());
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
  function hideFileIdText(box) {
    box.querySelectorAll("p, li, span, pre, code, div").forEach((n) => {
      if (n.closest(".gallery")) return;
      const t = (n.textContent || "").replace(/\s+/g, " ").trim();
      if (/^file_id:?$/i.test(t) || /^file_id\s*:/i.test(t) || /^(AgACAg|BAACAg)/.test(t)) {
        n.style.display = "none";
      }
    });
  }
  function renderGallery(box, items) {
    if (!items.length) return;
    let wrap = box.querySelector(".gallery");
    if (!wrap) {
      wrap = document.createElement("div");
      wrap.className = "gallery";
      const card = box.querySelector(".card") || box;
      card.insertBefore(wrap, card.firstChild);
    }
    let idx = Number(wrap.dataset.idx || -1);
    if (idx < 0) {
      idx = items.findIndex((x) => x.type !== "video");
      if (idx < 0) idx = 0;
    }
    if (idx >= items.length) idx = 0;
    const cur = items[idx];
    wrap.innerHTML = `
      <div class="gallery-hero">
        ${cur.type === "video"
          ? `<video src="${cur.src}" controls playsinline preload="metadata"></video>`
          : `<img src="${cur.src}" alt="" />`}
      </div>
      <div class="gallery-thumbs">
        ${items.map((m, i) => `
          <button type="button" class="g-thumb${i === idx ? " on" : ""}" data-g="${i}">
            ${m.type === "video"
              ? `<span class="play">▶</span>`
              : `<img src="${m.src}" alt="" loading="lazy" />`}
          </button>`).join("")}
      </div>`;
    wrap.dataset.idx = String(idx);
    wrap.querySelectorAll("[data-g]").forEach((btn) => {
      btn.addEventListener("click", (ev) => {
        ev.stopPropagation();
        wrap.dataset.idx = btn.getAttribute("data-g") || "0";
        renderGallery(box, items);
      });
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
      renderGallery(box, collect(lamp));
      hideFileIdText(box);
      setTimeout(() => hideFileIdText(box), 200);
    } catch (e) {
      console.warn(e);
    }
  }
  document.addEventListener("click", (ev) => {
    const card = ev.target.closest("[data-id]");
    if (!card || ev.target.closest("[data-fav]")) return;
    const id = card.getAttribute("data-id");
    const box = document.getElementById("detail");
    const g = box && box.querySelector(".gallery");
    if (g) g.dataset.idx = "-1";
    setTimeout(() => paint(id), 280);
  });
})();
