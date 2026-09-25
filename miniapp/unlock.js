(() => {
  function unlock() {
    ["boot", "gate", "citySheet", "rulesSheet", "guideSheet"].forEach((id) => {
      document.getElementById(id)?.classList.add("hidden");
    });
    document.querySelectorAll(".sheet").forEach((el) => {
      if (el.id === "guideSheet" || el.id === "citySheet" || el.id === "rulesSheet") {
        if (!el.classList.contains("open")) el.classList.add("hidden");
      }
    });
    const dock = document.getElementById("detailDock");
    if (dock) dock.style.display = "none";
    const app = document.getElementById("app");
    if (app) {
      app.style.pointerEvents = "auto";
      app.classList.remove("hidden");
    }
    document.body.style.pointerEvents = "auto";
  }
  unlock();
  setTimeout(unlock, 300);
  setTimeout(unlock, 1200);
})();
