(() => {
  if (!document.getElementById("yycj-pin-css")) {
    const st = document.createElement("style");
    st.id = "yycj-pin-css";
    st.textContent = `#pins{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;}
#pins .pin-card{flex:0 0 56%!important;aspect-ratio:3/4!important;height:auto!important;min-height:0!important;scroll-snap-align:start;border-radius:12px;overflow:hidden;position:relative!important;background-color:#141b2b!important;background-size:cover!important;background-position:center!important;}
#pins .pin-card img.pin-cover{position:absolute!important;inset:0!important;width:100%!important;height:100%!important;object-fit:cover!important;display:block!important;z-index:1!important;}
#pins .pin-copy{position:absolute!important;left:0!important;right:0!important;bottom:0!important;z-index:2!important;padding:28px 10px 10px!important;color:#fff!important;background:linear-gradient(transparent,rgba(0,0,0,.72))!important;}`;
    document.head.appendChild(st);
  }
  const cache = {};
  function token() { return localStorage.getItem("yycj_token") || ""; }
  function srcOf(u) {
    const s = String(u || "").trim();
    if (!s) return "";
    if (s.toLowerCase().startsWith("file_id:")) return srcOf(s.slice(8));
    if (s.startsWith("http") || s.startsWith("/")) return s;
    return "/api/media/file/" + encodeURIComponent(s);
  }
  function coverFrom(obj) {
    if (!obj) return "";
    for (const m of obj.media || []) {
      if ((m && m.type) === "video") continue;
      const u = srcOf(m && (m.preview_url || m.file_id || m.url));
      if (u) return u;
    }
    for (const p of obj.photos || []) {
      const u = srcOf(p);
      if (u && !String(p).startsWith("BAAC")) return u;
    }
    return "";
  }
  function stealFromFeed(id) {
    const card = document.querySelector('#feed [data-id="' + id + '"]');
    if (!card) return "";
    const img = card.querySelector("img.thumb, img");
    return (img && (img.getAttribute("src") || img.getAttribute("data-src"))) || "";
  }
  async function fetchCover(id) {
    if (!id) return "";
    if (cache[id]) return cache[id];
    try {
      const r = await fetch("/api/lamps/" + encodeURIComponent(id), { headers: { Authorization: "Bearer " + token() } });
      const data = await r.json();
      cache[id] = coverFrom(data.lamp || data.item || data);
      return cache[id];
    } catch (e) { return ""; }
  }
  async function fixOne(card) {
    const id = card.getAttribute("data-id") || "";
    let url = stealFromFeed(id) || card.getAttribute("data-cover") || "";
    if (!url) {
      const bg = (card.style && card.style.backgroundImage) || "";
      const m = bg.match(/url\(["']?([^"')]+)["']?\)/);
      if (m) url = m[1];
    }
    if (!url) url = await fetchCover(id);
    if (!url) return;
    let img = card.querySelector("img.pin-cover");
    if (!img) {
      img = document.createElement("img");
      img.className = "pin-cover";
      img.alt = "";
      card.insertBefore(img, card.firstChild);
    }
    if (img.getAttribute("src") !== url) img.setAttribute("src", url);
  }
  async function fixAll() {
    const pins = document.getElementById("pins");
    if (!pins) return;
    const cards = [...pins.querySelectorAll(".pin-card, [data-id]")];
    for (const card of cards) await fixOne(card);
  }
  setTimeout(fixAll, 300);
  setTimeout(fixAll, 1200);
  setInterval(fixAll, 2000);
  const pins = document.getElementById("pins");
  if (pins) new MutationObserver(() => setTimeout(fixAll, 80)).observe(pins, { childList: true });
})();
