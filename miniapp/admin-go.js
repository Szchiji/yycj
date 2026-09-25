(() => {
  if (window.__yycjAdminGo) return;
  window.__yycjAdminGo = true;
  const DESK = "./desk.html?v=20260925b";
  function go(ev) {
    const t = ev.target.closest("#adminEntry, #adminEntry a, a[href*='admin.html'], a[href*='console.html']");
    if (!t) return;
    ev.preventDefault();
    ev.stopPropagation();
    location.href = DESK;
  }
  function paint(isAdmin) {
    const entry = document.getElementById("adminEntry");
    const a = entry && entry.querySelector("a");
    if (a) {
      a.setAttribute("href", DESK);
      a.textContent = "管理后台";
    }
    if (entry && isAdmin) entry.classList.remove("hidden");
  }
  async function check() {
    try {
      const token = localStorage.getItem("yycj_token") || "";
      const r = await fetch("/api/me", { headers: { Authorization: "Bearer " + token } });
      const data = await r.json();
      paint(!!data.is_admin);
    } catch (e) {
      paint(false);
    }
  }
  document.addEventListener("click", go, true);
  document.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-nav='me']")) check();
  });
  setTimeout(check, 900);
})();
