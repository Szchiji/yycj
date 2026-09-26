(() => {
  if (window.__yycjUiNits) return;
  window.__yycjUiNits = true;
  document.addEventListener("click", (ev) => {
    if (ev.target.closest("#btnBackReview")) {
      ev.preventDefault();
      document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
      const id = window.__yycjOpenLamp;
      document.getElementById("view-detail")?.classList.remove("hidden");
      if (id && typeof window.openLamp === "function") window.openLamp(id);
    }
  }, true);
})();
