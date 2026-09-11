(() => {
  const token = () => localStorage.getItem("yycj_token") || "";
  let ids = new Set();
  function isGuest() {
    try { return (JSON.parse(localStorage.getItem("yycj_user") || "{}").role || "guest") === "guest"; }
    catch (e) { return document.body.classList.contains("role-guest"); }
  }
  async function load() {
    if (!token() || !isGuest()) return;
    try {
      const r = await fetch("/api/me/favorites", { headers: { Authorization: "Bearer " + token() } });
      const data = await r.json();
      ids = new Set(data.ids || []);
      paintHearts();
      paintMine(data.items || []);
    } catch (e) {}
  }
  function paintHearts() {
    document.querySelectorAll("[data-fav]").forEach((b) => {
      const on = ids.has(b.getAttribute("data-fav"));
      b.classList.toggle("on", on);
      b.textContent = on ? "♥" : "♡";
    });
  }
  function paintMine(items) {
    let box = document.getElementById("myFavs");
    if (!box) {
      const me = document.getElementById("view-me");
      if (!me || !isGuest()) return;
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = "<h3>我的收藏</h3><div id=\"myFavs\"></div>";
      me.appendChild(card);
      box = card.querySelector("#myFavs");
    }
    if (!box) return;
    box.innerHTML = (items || []).map((x) => `<div class="pick-item" data-id="${x.lamp_id}"><strong>${x.title || ""}</strong><span class="muted">${x.city || ""}</span></div>`).join("") || "<p class='muted'>还没有收藏</p>";
  }
  document.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("[data-fav]");
    if (!btn) return;
    ev.preventDefault();
    ev.stopPropagation();
    if (!isGuest()) return;
    try {
      const r = await fetch("/api/favorites/" + encodeURIComponent(btn.getAttribute("data-fav")), {
        method: "POST",
        headers: { Authorization: "Bearer " + token() },
      });
      const data = await r.json();
      if (data.favorited) ids.add(data.lamp_id); else ids.delete(data.lamp_id);
      paintHearts();
    } catch (e) {}
  }, true);
  setTimeout(load, 1400);
  document.querySelector('[data-nav="me"]')?.addEventListener("click", () => setTimeout(load, 200));
})();
