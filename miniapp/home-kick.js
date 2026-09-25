(() => {
  if (window.__yycjKick) return;
  window.__yycjKick = true;
  function token() { return localStorage.getItem("yycj_token") || ""; }
  function setFeed(html) {
    const feed = document.getElementById("feed");
    if (feed) feed.innerHTML = html;
  }
  async function kick() {
    for (let i = 0; i < 30 && !token(); i += 1) await new Promise((r) => setTimeout(r, 150));
    if (!token()) {
      setFeed("<p class='muted'>还未登录，请从机器人重新打开</p>");
      return;
    }
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 8000);
    try {
      const r = await fetch("/api/home?limit=12", {
        headers: { Authorization: "Bearer " + token() },
        signal: ctl.signal,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.detail || ("HTTP " + r.status));
      if (typeof window.__yycjReloadHome === "function") window.__yycjReloadHome();
      else if (data.items && data.items.length && document.getElementById("feed") && !document.querySelector("#feed [data-id]")) {
        setFeed("<p class='muted'>已取到 " + data.items.length + " 条，请点底栏首页刷新</p>");
      }
      const btn = document.getElementById("btnCity");
      if (btn && data.city) btn.textContent = data.city + " ▾";
    } catch (e) {
      setFeed("<p class='muted'>加载超时或失败</p><button class='btn' type='button' id='btnKickRetry'>重试</button>");
    } finally {
      clearTimeout(timer);
    }
  }
  document.addEventListener("click", (ev) => {
    if (ev.target && ev.target.id === "btnKickRetry") kick();
  });
  setTimeout(kick, 600);
})();
