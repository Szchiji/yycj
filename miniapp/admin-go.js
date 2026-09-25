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
  function paint() {
    const a = document.querySelector("#adminEntry a");
    if (a) {
      a.setAttribute("href", DESK);
      a.textContent = "管理后台";
    }
  }
  document.addEventListener("click", go, true);
  paint();
})();
