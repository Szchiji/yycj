(() => {
  function showBoot(msg) {
    const boot = document.querySelector("#boot");
    if (!boot) return;
    boot.classList.remove("hidden");
    document.querySelector("#gate")?.classList.add("hidden");
    document.querySelector("#app")?.classList.add("hidden");
    if (msg != null) {
      const el = document.querySelector("#bootMsg");
      if (el) el.textContent = msg;
    }
  }
  function hideBoot() {
    document.querySelector("#boot")?.classList.add("hidden");
    document.querySelector("#bootRetry")?.classList.add("hidden");
  }
  function showBootError(msg) {
    showBoot(msg || "连接失败，请重试");
    document.querySelector("#bootRetry")?.classList.remove("hidden");
  }
  window.__yycjBoot = { showBoot, hideBoot, showBootError };
  if (!document.querySelector('script[src*="publish-fields"]')) {
    const s = document.createElement("script");
    s.src = "./publish-fields.js?v=20260912j";
    (document.body || document.documentElement).appendChild(s);
  }
})();
