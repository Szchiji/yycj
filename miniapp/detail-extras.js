(() => {
  if (window.__yycjDetailExtras) return;
  window.__yycjDetailExtras = true;
  const token = () => localStorage.getItem("yycj_token") || "";
  function paint(lamp) {
    const detail = document.getElementById("detail");
    if (!detail || !lamp) return;
    const extras = lamp.extras && typeof lamp.extras === "object" ? lamp.extras : {};
    const keys = Object.keys(extras).filter((k) => extras[k]);
    let box = document.getElementById("yycjExtras");
    if (!keys.length) {
      if (box) box.remove();
      return;
    }
    if (!box) {
      box = document.createElement("div");
      box.id = "yycjExtras";
      box.className = "card";
      detail.appendChild(box);
    }
    box.innerHTML = keys.map((k) => "<p><b>" + k + "</b>：" + String(extras[k]).replace(/[<>]/g, "") + "</p>").join("");
  }
  async function load(id) {
    if (!id) return;
    try {
      const r = await fetch("/api/lamps/" + encodeURIComponent(id), { headers: { Authorization: "Bearer " + token() } });
      if (!r.ok) return;
      const data = await r.json();
      paint(data.lamp || data);
    } catch (e) {}
  }
  document.addEventListener("click", (ev) => {
    const card = ev.target.closest("#feed [data-id], #pins [data-id], #favList [data-id]");
    if (!card) return;
    setTimeout(() => load(card.getAttribute("data-id")), 280);
  });
})();
