(() => {
  if (window.__yycjAwayJs) return;
  window.__yycjAwayJs = true;
  function killMedia() {
    document.querySelectorAll("video").forEach((v) => {
      try {
        v.pause();
        v.removeAttribute("src");
        v.load();
      } catch (e) {}
    });
    if (typeof window.__yycjPauseUi === "function") window.__yycjPauseUi();
  }
  window.__yycjKillMedia = killMedia;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) killMedia();
  });
  window.addEventListener("pagehide", killMedia);
  window.addEventListener("pageshow", (ev) => {
    if (ev.persisted) killMedia();
  });
})();
