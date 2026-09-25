(() => {
  window.__yycjBoot = window.__yycjBoot || {
    showBoot(msg) {
      const boot = document.querySelector("#boot");
      if (!boot) return;
      boot.classList.remove("hidden");
      document.querySelector("#gate")?.classList.add("hidden");
      document.querySelector("#app")?.classList.add("hidden");
      if (msg != null) {
        const el = document.querySelector("#bootMsg");
        if (el) el.textContent = msg;
      }
    },
    hideBoot() {
      document.querySelector("#boot")?.classList.add("hidden");
      document.querySelector("#bootRetry")?.classList.add("hidden");
    },
  };
})();
