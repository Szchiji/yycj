(() => {
  const side = document.getElementById("adminSide");
  if (!side) return;
  document.body.classList.add("admin-has-side");
  if (!document.getElementById("btnSide")) {
    const btn = document.createElement("button");
    btn.id = "btnSide";
    btn.type = "button";
    btn.className = "btn side-toggle";
    btn.textContent = "菜单";
    document.querySelector(".topbar")?.appendChild(btn);
    btn.addEventListener("click", (ev) => {
      ev.stopPropagation();
      document.body.classList.toggle("side-open");
    });
  }
  document.getElementById("adminSide")?.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-pane]")) document.body.classList.remove("side-open");
  });
  document.querySelector(".admin-main")?.addEventListener("click", () => {
    document.body.classList.remove("side-open");
  });
})();
