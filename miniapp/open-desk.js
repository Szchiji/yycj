(() => {
  const DESK = "./desk.html?v=20260920z";
  function retarget() {
    const a = document.querySelector("#adminEntry a");
    if (a) {
      a.setAttribute("href", DESK);
      a.textContent = "管理后台";
    }
  }
  document.addEventListener("click", (ev) => {
    const t = ev.target.closest("#adminEntry, #adminEntry a, a[href*='admin.html'], a[href*='console.html']");
    if (!t) return;
    ev.preventDefault();
    ev.stopPropagation();
    location.href = DESK;
  }, true);
  retarget();
  setInterval(retarget, 400);
})();
