(() => {
  if (window.__yycjDetailExtras) return;
  window.__yycjDetailExtras = true;
  const token = () => localStorage.getItem("yycj_token") || "";
  function paint(extras) {
    const detail = document.getElementById("detail");
    if (!detail) return;
    const data = extras && typeof extras === "object" ? extras : {};
    const keys = Object.keys(data).filter((k) => String(data[k] || "").trim());
    let box = document.getElementById("yycjExtras");
    if (!keys.length) {
      if (box) box.remove();
      return;
    }
    if (!box) {
      box = document.createElement("div");
      box.id = "yycjExtras";
      box.className = "card";
      const reviews = document.getElementById("yycjReviews");
      if (reviews) detail.insertBefore(box, reviews);
      else detail.appendChild(box);
    }
    box.innerHTML = keys.map((k) => "<p><b>" + k + "</b>：" + String(data[k]).replace(/[<>]/g, "") + "</p>").join("");
  }
  async function load(id) {
    if (!id) return;
    try {
      const r = await fetch("/api/lamps/" + encodeURIComponent(id), { headers: { Authorization: "Bearer " + token() } });
      if (!r.ok) return;
      const data = await r.json();
      const lamp = data.lamp || data;
      paint(lamp.extras || data.extras || {});
    } catch (e) {}
  }
  document.addEventListener("click", (ev) => {
    const card = ev.target.closest("#feed [data-id], #pins [data-id], #favList [data-id]");
    if (!card) return;
    const id = card.getAttribute("data-id");
    setTimeout(() => load(id), 200);
    setTimeout(() => load(id), 800);
  });
})();
