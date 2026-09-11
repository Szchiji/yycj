(() => {
  const token = () => localStorage.getItem("yycj_token") || "";
  let ids = new Set();
  let items = [];
  function isGuest() {
    try { return (JSON.parse(localStorage.getItem("yycj_user") || "{}").role || "guest") === "guest"; }
    catch (e) { return true; }
  }
  function mediaSrc(u) {
    const s = String(u || "").trim();
    if (!s) return "";
    if (s.startsWith("http") || s.startsWith("/")) return s;
    return "/api/media/file/" + encodeURIComponent(s);
  }
  function cover(item) {
    for (const m of item.media || []) {
      if ((m && m.type) === "video") continue;
      const u = mediaSrc((m && (m.preview_url || m.file_id || m.url)) || "");
      if (u) return u;
    }
    return "";
  }
  function showView(id) {
    document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
    document.getElementById(id)?.classList.remove("hidden");
    document.querySelectorAll(".nav-item").forEach((b) => {
      const nav = b.getAttribute("data-nav");
      b.classList.toggle("active", (id === "view-fav" && nav === "fav") || (id === "view-home" && nav === "home") || (id === "view-me" && nav === "me"));
    });
  }
  function cardHtml(x) {
    const img = cover(x);
    const loc = [x.city, x.district].filter(Boolean).join("·");
    const tag = (x.tags && x.tags[0]) || "";
    const n = (x.media && x.media.length) || 0;
    return `<div class="feed-card compact cover-card" data-id="${x.lamp_id}">
      <div class="cover-wrap">
        ${img ? `<img class="thumb" src="${img}" alt="" />` : `<div class="thumb ph"></div>`}
        ${loc ? `<span class="badge-loc">${loc}</span>` : ""}
        ${tag ? `<span class="badge-tag">${tag}</span>` : ""}
        ${n ? `<span class="badge-n">${n}图</span>` : ""}
      </div>
      <div class="body">
        <h3>${x.title || ""}</h3>
        <div class="muted price">${x.price_text || ""}</div>
        <button class="btn unfav" type="button" data-unfav="${x.lamp_id}">取消收藏</button>
      </div>
    </div>`;
  }
  function paintHearts() {
    document.querySelectorAll("[data-fav]").forEach((b) => {
      const on = ids.has(b.getAttribute("data-fav"));
      b.classList.toggle("on", on);
      b.textContent = on ? "♥" : "♡";
    });
  }
  function paintList() {
    const box = document.getElementById("favList");
    if (box) box.innerHTML = items.map(cardHtml).join("") || "<p class='muted'>还没有收藏</p>";
  }
  async function load() {
    if (!token() || !isGuest()) return;
    try {
      const r = await fetch("/api/me/favorites", { headers: { Authorization: "Bearer " + token() } });
      const data = await r.json();
      ids = new Set(data.ids || []);
      items = data.items || [];
      paintHearts();
      paintList();
    } catch (e) {}
  }
  async function toggle(id) {
    const r = await fetch("/api/favorites/" + encodeURIComponent(id), {
      method: "POST",
      headers: { Authorization: "Bearer " + token() },
    });
    const data = await r.json();
    if (data.favorited) ids.add(id);
    else {
      ids.delete(id);
      items = items.filter((x) => x.lamp_id !== id);
    }
    paintHearts();
    paintList();
  }
  function bindBackToFav() {
    window.__yycjBack = "fav";
    const back = document.getElementById("btnBackHome");
    if (!back) return;
    back.onclick = (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      showView("view-fav");
      load();
    };
  }
  document.addEventListener("click", async (ev) => {
    if (ev.target.closest("[data-nav='fav']")) {
      ev.preventDefault();
      ev.stopPropagation();
      window.__yycjBack = "fav";
      showView("view-fav");
      load();
      return;
    }
    if (ev.target.closest("[data-nav='home']")) window.__yycjBack = "home";
    const un = ev.target.closest("[data-unfav]");
    if (un) {
      ev.preventDefault();
      ev.stopPropagation();
      try { await toggle(un.getAttribute("data-unfav")); } catch (e) {}
      return;
    }
    const heart = ev.target.closest("[data-fav]");
    if (heart) {
      ev.preventDefault();
      ev.stopPropagation();
      if (!isGuest()) return;
      try { await toggle(heart.getAttribute("data-fav")); } catch (e) {}
      return;
    }
    const card = ev.target.closest("#favList [data-id]");
    if (card) {
      ev.preventDefault();
      ev.stopPropagation();
      bindBackToFav();
      if (window.openLamp) window.openLamp(card.getAttribute("data-id"));
      else showView("view-detail");
    }
  }, true);
  document.getElementById("btnBackHome")?.addEventListener("click", (ev) => {
    if (window.__yycjBack === "fav") {
      ev.preventDefault();
      ev.stopPropagation();
      showView("view-fav");
      load();
    }
  }, true);
  setTimeout(load, 1400);
})();
