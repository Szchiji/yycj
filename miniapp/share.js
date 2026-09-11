(() => {
  function botUser() {
    return (window.__yycjBot || localStorage.getItem("yycj_bot") || "").replace(/^@/, "");
  }
  function startLink(lampId) {
    const bot = botUser();
    const payload = "s_" + String(lampId || "").replace(/-/g, "");
    return bot ? ("https://t.me/" + bot + "?start=" + payload) : location.origin;
  }
  function textFor(card, lampId) {
    const title = ((card.querySelector("h3") || {}).textContent || "月影车姬").trim();
    const price = ((card.querySelector(".price") || {}).textContent || "").trim();
    return `月影车姬｜${title} ${price}\n点链接先加机器人和频道，再看这条资料\n${startLink(lampId)}`;
  }
  function share(text, lampId) {
    const tg = window.Telegram && window.Telegram.WebApp;
    const link = startLink(lampId);
    const url = "https://t.me/share/url?url=" + encodeURIComponent(link) + "&text=" + encodeURIComponent(text);
    try {
      if (tg && tg.switchInlineQuery) {
        tg.switchInlineQuery(text, ["users", "groups"]);
        return;
      }
    } catch (e) {}
    if (tg && tg.openTelegramLink) tg.openTelegramLink(url);
    else location.href = url;
  }
  document.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-share]");
    if (!btn) return;
    ev.preventDefault();
    ev.stopPropagation();
    const card = btn.closest("[data-id], #view-detail, .cover-card") || document.body;
    const lampId = btn.getAttribute("data-share") || (card.getAttribute && card.getAttribute("data-id")) || "";
    share(textFor(card, lampId), lampId);
  }, true);
  async function rememberBot() {
    try {
      const r = await fetch("/api/home?limit=1", { headers: { Authorization: "Bearer " + (localStorage.getItem("yycj_token") || "") } });
      const data = await r.json();
      const name = (data.bot && (data.bot.username || data.bot)) || data.bot_username || "";
      if (name) {
        window.__yycjBot = String(name).replace(/^@/, "");
        localStorage.setItem("yycj_bot", window.__yycjBot);
      }
    } catch (e) {}
  }
  function openShared() {
    const tg = window.Telegram && window.Telegram.WebApp;
    const raw = (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || new URLSearchParams(location.search).get("lamp") || "";
    if (!raw) return;
    let id = String(raw).replace(/^s_/, "");
    if (id.length === 32 && id.indexOf("-") < 0) {
      id = id.slice(0,8)+"-"+id.slice(8,12)+"-"+id.slice(12,16)+"-"+id.slice(16,20)+"-"+id.slice(20);
    }
    if (id && window.openLamp) setTimeout(() => window.openLamp(id), 600);
    else if (id) setTimeout(() => openShared(), 400);
  }
  rememberBot();
  setTimeout(openShared, 800);
})();
