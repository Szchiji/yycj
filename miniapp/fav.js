(() => {
  if (window.__yycjFav) return;
  window.__yycjFav = true;
  const token = () => localStorage.getItem("yycj_token") || "";
  let ids = new Set();
  let items = [];
  if (!document.getElementById("yycj-fav-css")) {
    const st = document.createElement("style");
    st.id = "yycj-fav-css";
    st.textContent = `.fav-btn.on,#detailFavTop.on{color:#ff6b8a!important;} .fav-btn{color:#fff;}`;
    document.head.appendChild(st);
  }
  function isGuest() {
    try { return (JSON.parse(localStorage.getItem("yycj_user") || "{}").role || "guest") === "guest"; }
    catch (e) { return true; }
  }
  function cover(item) {
    return window.yycjCoverOf ? window.yycjCoverOf(item) : "";
  }
  function showView(id) {
    document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
    document.getElementById(id)?.classList.remove("hidden");
  }
  function cardHtml(x) {
    const img = cover(x) || x.cover_url || "";
    const loc = [x.city, x.district].filter(Boolean).join("·");
    const tag = (x.tags && x.tags[0]) || "";
    const n = x.media_count || (x.media && x.media.length) || (x.photos && x.photos.length) || 0;
    return "<div class=\"feed-card compact cover-card\" data-id=\"" + x.lamp_id + "\"><div class=\"cover-wrap\">" +
      (img ? "<img class=\"thumb\" src=\"" + img + "\" alt=\"\" loading=\"lazy\" decoding=\"async\" />" : "<div class=\"thumb ph\"></div>") +
      (loc ? "<span class=\"badge-loc\">" + loc + "</span>" : "") +
      (tag ? "<span class=\"badge-tag\">" + tag + "</span>" : "") +
      (n ? "<span class=\"badge-n\">" + n + "图</span>" : "") +
      "</div><div class=\"body\"><h3>" + (x.title || "") + "</h3><div class=\"muted price\">" + (x.price_text || "") +
      "</div><button class=\"btn unfav\" type=\"button\" data-unfav=\"" + x.lamp_id + "\">取消收藏</button></div></div>";
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
  window.__yycjPaintFav = paintHearts;
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
    }
  }, true);
  document.getElementById("btnBackHome")?.addEventListener("click", (ev) => {
    if (window.__yycjBack === "fav") {
      ev.preventDefault();
      ev.stopPropagation();
      showView("view-fav");
      load();
    } else {
      window.__yycjBack = "home";
    }
  }, true);
})();
