(() => {
  const cache = {};
  function token() { return localStorage.getItem("yycj_token") || ""; }
  function srcOf(u) {
    const s = String(u || "").trim();
    if (!s) return "";
    if (s.toLowerCase().startsWith("file_id:")) return srcOf(s.slice(8));
    if (s.startsWith("http") || s.startsWith("/")) return s;
    return "/api/media/file/" + encodeURIComponent(s);
  }
  function cover(item) {
    for (const m of item.media || []) {
      const raw = (m && (m.file_id || m.url || m.preview_url)) || "";
      if ((m && m.type) === "video") continue;
      const u = srcOf(m && (m.preview_url || m.file_id || m.url));
      if (u) return u;
    }
    for (const p of item.photos || []) {
      const u = srcOf(p);
      if (u && !String(p).startsWith("BAAC")) return u;
    }
    return "";
  }
  function decorate(card, url) {
    if (!card || !url) return;
    if (card.querySelector("img.pin-cover")) {
      const img = card.querySelector("img.pin-cover");
      if (img.getAttribute("src") !== url) img.src = url;
      return;
    }
    const img = document.createElement("img");
    img.className = "pin-cover";
    img.src = url;
    img.alt = "";
    card.insertBefore(img, card.firstChild);
  }
  async function lampCover(id) {
    if (!id) return "";
    if (cache[id]) return cache[id];
    try {
      const r = await fetch("/api/lamps/" + encodeURIComponent(id), { headers: { Authorization: "Bearer " + token() } });
      const data = await r.json();
      const url = cover(data.lamp || data.item || data || {});
      cache[id] = url;
      return url;
    } catch (e) { return ""; }
  }
  async function fixPins() {
    const pins = document.getElementById("pins");
    if (!pins) return;
    const cards = [...pins.querySelectorAll("[data-id], .pin-card")];
    for (const card of cards) {
      if (card.querySelector("img.pin-cover[src]")) continue;
      const id = card.getAttribute("data-id") || "";
      const url = card.getAttribute("data-bg") || await lampCover(id);
      decorate(card, url);
    }
  }
  setInterval(fixPins, 1200);
  setTimeout(fixPins, 400);
})();
