(() => {
  const side = document.getElementById("adminSide");
  if (!side) return;
  document.body.classList.add("admin-has-side");
  document.getElementById("btnSide")?.remove();
  const title = document.querySelector(".topbar h1");
  if (title) {
    title.style.cursor = "pointer";
    title.title = "点击展开菜单";
    if (!title.querySelector(".menu-caret")) {
      const caret = document.createElement("span");
      caret.className = "menu-caret";
      caret.textContent = " ▾";
      caret.style.fontSize = ".7em";
      caret.style.opacity = ".7";
      title.appendChild(caret);
    }
    title.addEventListener("click", (ev) => {
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
