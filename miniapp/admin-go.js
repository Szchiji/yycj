(() => {
  if (window.__yycjAdminGo) return;
  window.__yycjAdminGo = true;
  const DESK = "./desk.html?v=r9";
  function contacts() {
    return ((window.__yycjHomeData || {}).contacts || {});
  }
  function goDesk() {
    location.href = DESK;
  }
  function goAdminLink() {
    const c = contacts();
    const href = c.admin_url || c.admin || "";
    if (href && window.__yycjOpenChat) {
      window.__yycjOpenChat(href);
      return;
    }
    if (href) location.href = href;
  }
  async function isAdmin() {
    try {
      const token = localStorage.getItem("yycj_token") || "";
      const r = await fetch("/api/me", { headers: { Authorization: "Bearer " + token } });
      const data = await r.json();
      return !!data.is_admin;
    } catch (e) {
      return false;
    }
  }
  function paint(ok) {
    const entry = document.getElementById("adminEntry");
    const a = entry && entry.querySelector("a");
    if (a) {
      a.setAttribute("href", DESK);
      a.textContent = "管理后台";
    }
    if (entry && ok) entry.classList.remove("hidden");
    const top = document.getElementById("topAdmin");
    if (top) {
      top.style.pointerEvents = "auto";
      top.style.zIndex = "20";
    }
  }
  document.addEventListener("click", async (ev) => {
    if (ev.target.closest("#topAdmin")) {
      ev.preventDefault();
      ev.stopPropagation();
      if (await isAdmin()) goDesk();
      else goAdminLink();
      return;
    }
    const t = ev.target.closest("#adminEntry, #adminEntry a, a[href*='admin.html'], a[href*='console.html'], a[href*='desk.html']");
    if (!t) return;
    ev.preventDefault();
    ev.stopPropagation();
    goDesk();
  }, true);
  document.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-nav='me']")) isAdmin().then(paint);
  });
  setTimeout(() => isAdmin().then(paint), 400);
})();
