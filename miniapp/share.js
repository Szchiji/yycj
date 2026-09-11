(() => {
  function botLink() {
    const u = (window.__yycjBot || localStorage.getItem("yycj_bot") || "").replace(/^@/, "");
    return u ? ("https://t.me/" + u) : location.origin;
  }
  function textFor(card) {
    const title = (card.querySelector("h3") || {}).textContent || "月影车姬";
    const price = (card.querySelector(".price") || {}).textContent || "";
    return `月影车姬｜${title.trim()} ${price.trim()}\n${botLink()}`;
  }
  function share(text) {
    const tg = window.Telegram && window.Telegram.WebApp;
    const url = "https://t.me/share/url?url=" + encodeURIComponent(botLink()) + "&text=" + encodeURIComponent(text);
    try {
      if (tg && tg.switchInlineQuery) {
        tg.switchInlineQuery(text, ["users", "groups", "channels"]);
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
    share(textFor(card));
  }, true);
})();
