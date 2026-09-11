(() => {
  const side = document.getElementById("adminSide");
  if (!side) return;
  document.body.classList.add("admin-has-side");
  const titles = { audit: "审核", listings: "上架资料", pin: "卡片置顶", carousel: "精选轮播", venue: "站点设置", users: "用户", more: "风控" };
  const crumb = document.getElementById("adminCrumb");
  function setCrumb(pane) { if (crumb) crumb.textContent = titles[pane] || "管理"; }
  document.getElementById("btnMenu")?.addEventListener("click", (ev) => {
    ev.stopPropagation();
    document.body.classList.toggle("side-open");
  });
  document.getElementById("sideMask")?.addEventListener("click", () => document.body.classList.remove("side-open"));
  side.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-pane]");
    if (!btn) return;
    setCrumb(btn.getAttribute("data-pane"));
    document.body.classList.remove("side-open");
  });
  const on = side.querySelector(".active");
  if (on) setCrumb(on.getAttribute("data-pane"));
})();
