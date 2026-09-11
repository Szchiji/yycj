(() => {
  const token = () => localStorage.getItem("yycj_token") || "";
  let ids = new Set();
  function isGuest() {
    try { return (JSON.parse(localStorage.getItem("yycj_user") || "{}").role || "guest") === "guest"; }
    catch (e) { return true; }
  }
  function showFav() {
    document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
    document.getElementById("view-fav")?.classList.remove("hidden");
    document.querySelectorAll(".nav-item").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-nav") === "fav");
    });
  }
  async function load() {
    if (!token() || !isGuest()) return;
    try {
      const r = await fetch("/api/me/favorites", { headers: { Authorization: "Bearer " + token() } });
      const data = await r.json();
      ids = new Set(data.ids || []);
      document.querySelectorAll("[data-fav]").forEach((b) => {
        const on = ids.has(b.getAttribute("data-fav"));
        b.classList.toggle("on", on);
        b.textContent = on ? "♥" : "♡";
      });
      const box = document.getElementById("favList");
      if (box) {
        const items = data.items || [];
        box.innerHTML = items.map((x) => `<div class="feed-card compact cover-card" data-id="${x.lamp_id}">
          <div class="body"><h3>${x.title || ""}</h3><div class="muted">${x.city || ""} · ${x.price_text || ""}</div></div>
        </div>`).join("") || "<p class='muted'>还没有收藏</p>";
      }
    } catch (e) {}
  }
  document.addEventListener("click", async (ev) => {
    if (ev.target.closest("[data-nav='fav']")) {
      ev.preventDefault();
      ev.stopPropagation();
      showFav();
      load();
      return;
    }
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
      document.querySelectorAll("[data-fav]").forEach((b) => {
        const on = ids.has(b.getAttribute("data-fav"));
        b.classList.toggle("on", on);
        b.textContent = on ? "♥" : "♡";
      });
    } catch (e) {}
  }, true);
  setTimeout(load, 1500);
})();
