(() => {
  if (window.__yycjLifeJs) return;
  window.__yycjLifeJs = true;
  const tg = window.Telegram && window.Telegram.WebApp;
  const life = { state: "boot", view: "home", awayAt: 0 };
  window.__yycjLife = life;
  let hideTimer = 0;

  function killMedia() {
    document.querySelectorAll("video").forEach((v) => {
      try {
        v.pause();
        v.removeAttribute("src");
        v.load();
      } catch (e) {}
    });
    if (typeof window.__yycjPauseUi === "function") {
      try { window.__yycjPauseUi(); } catch (e) {}
    }
  }

  function recover() {
    life.state = "ready";
    try {
      if (tg && tg.expand) tg.expand();
    } catch (e) {}
    const app = document.getElementById("app");
    const boot = document.getElementById("boot");
    const token = localStorage.getItem("yycj_token") || "";
    if (token && app) {
      app.classList.remove("hidden");
      if (boot) boot.classList.add("hidden");
      const open = document.querySelector("#app .view:not(.hidden)");
      if (!open) {
        const home = document.getElementById("view-home");
        if (home) home.classList.remove("hidden");
      }
    }
    const feed = document.getElementById("feed");
    if (feed && !feed.querySelector("[data-id]") && typeof window.__yycjLoadHome === "function") {
      try { window.__yycjLoadHome(); } catch (e) {}
    }
    document.body.style.opacity = "0.99";
    requestAnimationFrame(() => { document.body.style.opacity = "1"; });
  }

  function pause(reason) {
    life.state = reason === "away" ? "away" : "hidden";
    if (reason === "away") life.awayAt = Date.now();
    killMedia();
  }

  function openChat(href) {
    if (!href) return false;
    pause("away");
    try {
      if (tg && tg.openTelegramLink && /t\.me\/|tg:\/\//i.test(href)) {
        setTimeout(() => {
          try { tg.openTelegramLink(href); } catch (e) {}
        }, 40);
        return true;
      }
    } catch (e) {}
    return false;
  }

  window.__yycjKillMedia = killMedia;
  window.__yycjOpenChat = openChat;
  window.__yycjRecover = recover;

  if (tg) {
    try {
      tg.ready();
      if (tg.expand) tg.expand();
    } catch (e) {}
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      hideTimer = window.setTimeout(() => pause(life.state === "away" ? "away" : "hidden"), 280);
      return;
    }
    window.clearTimeout(hideTimer);
    recover();
  });
  window.addEventListener("pageshow", () => {
    window.clearTimeout(hideTimer);
    recover();
  });
  window.addEventListener("focus", recover);

  document.addEventListener("DOMContentLoaded", () => {
    if (localStorage.getItem("yycj_token")) recover();
  });
})();
