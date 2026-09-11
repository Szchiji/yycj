(() => {
  if (window.__yycjDetailExtras) return;
  window.__yycjDetailExtras = true;
  const token = () => localStorage.getItem("yycj_token") || "";
  function paint(lamp) {
    const detail = document.getElementById("detail");
    if (!detail) return;
    const extras = (lamp && lamp.extras) || {};
    const keys = Object.keys(extras).filter((k) => extras[k]);
    let box = document.getElementById("yycjExtras");
    if (!keys.length) {
      box?.remove();
      return;
    }
    if (!box) {
      box = document.createElement("div");
      box.id = "yycjExtras";
      box.className = "card";
      const chat = document.getElementById("detailChat");
      if (chat && chat.parentNode) chat.parentNode.insertBefore(box, chat);
      else detail.appendChild(box);
    }
    box.innerHTML = keys.map((k) => `<p><b>${k}</b>：${String(extras[k]).replace(/[<>]/g, "")}</p>`).join("");
  }
  async function load(id) {
    if (!id) return;
    try {
      const r = await fetch("/api/lamps/" + encodeURIComponent(id), { headers: { Authorization: "Bearer " + token() } });
      const data = await r.json();
      paint(data.lamp || data);
    } catch (e) {}
  }
  document.addEventListener("click", (ev) => {
    const card = ev.target.closest("[data-id]");
    if (!card) return;
    setTimeout(() => load(card.getAttribute("data-id")), 200);
  }, true);
})();
