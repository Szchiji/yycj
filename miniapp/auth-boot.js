(() => {
  if (window.__yycjAuthBoot) return;
  window.__yycjAuthBoot = true;
  const tg = window.Telegram && window.Telegram.WebApp;
  try { tg && tg.ready && tg.ready(); tg && tg.expand && tg.expand(); } catch (e) {}
  function feed(html) {
    const el = document.getElementById("feed");
    if (el) el.innerHTML = html;
  }
  function initData() {
    return (tg && tg.initData) || "";
  }
  async function auth() {
    const data = initData();
    if (!data) return false;
    const r = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initData: data }),
    });
    const js = await r.json().catch(() => ({}));
    if (!r.ok || !js.token) throw new Error(js.detail || "登录失败");
    localStorage.setItem("yycj_token", js.token);
    if (js.user) localStorage.setItem("yycj_user", JSON.stringify(js.user));
    return true;
  }
  async function boot() {
    for (let i = 0; i < 40 && !initData(); i += 1) await new Promise((r) => setTimeout(r, 100));
    if (!initData()) {
      feed("<p class='muted'>请在 Telegram 机器人里打开小程序</p>");
      return;
    }
    try {
      await auth();
      document.getElementById("boot")?.classList.add("hidden");
      document.getElementById("app")?.classList.remove("hidden");
      if (typeof window.__yycjReloadHome === "function") window.__yycjReloadHome();
    } catch (e) {
      feed("<p class='muted'>登录失败：" + String(e.message || e) + "</p>");
    }
  }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
