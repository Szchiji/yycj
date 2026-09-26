(() => {
  if (window.__yycjLife) return;
  const tg = window.Telegram && window.Telegram.WebApp;
  const life = {
    state: "boot",
    view: "home",
    awayAt: 0,
  };
  window.__yycjLife = life;

  function killMedia() {
    document.querySelectorAll("video").forEach((v) => {
      try {
        v.pause();
        v.removeAttribute("src");
        while (v.firstChild) v.removeChild(v.firstChild);
        v.load();
      } catch (e) {}
    });
    if (typeof window.__yycjPauseUi === "function") window.__yycjPauseUi();
  }

  function pause(reason) {
    life.state = reason === "away" ? "away" : "hidden";
    if (reason === "away") life.awayAt = Date.now();
    killMedia();
  }

  function resume() {
    if (life.state === "boot") return;
    life.state = "ready";
    if (typeof window.__yycjResumeUi === "function") {
      try { window.__yycjResumeUi(); } catch (e) {}
    }
  }

  function openChat(href) {
    if (!href) return false;
    pause("away");
    try {
      if (tg && tg.openTelegramLink && /t\.me\/|tg:\/\//i.test(href)) {
        setTimeout(() => {
          try { tg.openTelegramLink(href); } catch (e) {}
        }, 30);
        return true;
      }
    } catch (e) {}
    return false;
  }

  window.__yycjKillMedia = killMedia;
  window.__yycjOpenChat = openChat;

  if (tg) {
    try {
      tg.ready();
      if (tg.expand) tg.expand();
      if (tg.disableVerticalSwipes) tg.disableVerticalSwipes();
    } catch (e) {}
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) pause(life.state === "away" ? "away" : "hidden");
    else resume();
  });
  window.addEventListener("pagehide", () => pause(life.state === "away" ? "away" : "hidden"));
  window.addEventListener("pageshow", (ev) => {
    if (ev.persisted) pause("hidden");
    resume();
  });
  window.addEventListener("freeze", () => pause("hidden"));
  window.addEventListener("resume", resume);

  life.state = "ready";
})();
