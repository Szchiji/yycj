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
    const retry = document.querySelector("#bootRetry");
    if (retry) retry.classList.add("hidden");
  }
  function showBootError(msg) {
    showBoot(msg || "连接失败，请重试");
    const retry = document.querySelector("#bootRetry");
    if (retry) retry.classList.remove("hidden");
  }
  function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
  async function waitForInitData(timeoutMs = 3500) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const cur = window.Telegram && window.Telegram.WebApp;
      const initData = (cur && cur.initData) || "";
      if (initData) return initData;
      await sleep(100);
    }
    const cur = window.Telegram && window.Telegram.WebApp;
    return (cur && cur.initData) || "";
  }
  window.__yycjBoot = { showBoot, hideBoot, showBootError, waitForInitData };
})();
