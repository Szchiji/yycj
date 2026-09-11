(() => {
  if (window.__yycjRescue) return;
  window.__yycjRescue = true;
  function rescue() {
    const app = document.getElementById("app");
    const gate = document.getElementById("gate");
    const boot = document.getElementById("boot");
    if (!app) return;
    if (app.classList.contains("hidden") && boot && boot.classList.contains("hidden")) {
      gate?.classList.add("hidden");
      app.classList.remove("hidden");
    }
  }
  setTimeout(rescue, 1200);
})();
