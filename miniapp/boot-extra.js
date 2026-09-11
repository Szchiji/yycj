(() => {
  if (window.__yycjBootExtra) return;
  window.__yycjBootExtra = true;
  const st = document.getElementById("yycj-home-hide") || document.createElement("style");
  st.id = "yycj-home-hide";
  st.textContent = "#feed:not(.yycj-on),#pins:not(.yycj-on){visibility:hidden!important;}";
  document.head.appendChild(st);
  let goodFeed = "";
  let goodPins = "";
  let lock = false;
  function watch() {
    if (lock) return;
    const feed = document.getElementById("feed");
    const pins = document.getElementById("pins");
    if (feed) {
      if (feed.querySelector(".cover-card")) {
        goodFeed = feed.innerHTML;
        feed.classList.add("yycj-on", "has-cover");
      } else if (goodFeed) {
        lock = true;
        feed.innerHTML = goodFeed;
        feed.classList.add("yycj-on", "has-cover");
        lock = false;
      }
    }
    if (pins) {
      if (pins.querySelector(".pin-cover,.pin-card.short")) {
        goodPins = pins.innerHTML;
        pins.classList.add("yycj-on");
      } else if (goodPins && !pins.classList.contains("hidden")) {
        lock = true;
        pins.innerHTML = goodPins;
        pins.classList.add("yycj-on");
        lock = false;
      } else if (pins.classList.contains("hidden")) {
        pins.classList.add("yycj-on");
      }
    }
  }
  const feed = document.getElementById("feed");
  const pins = document.getElementById("pins");
  if (feed) new MutationObserver(watch).observe(feed, { childList: true });
  if (pins) new MutationObserver(watch).observe(pins, { childList: true });
  setInterval(watch, 300);
  ["scroll-perf.js", "carousel-sync.js", "keyboard-fix.js", "deep-open.js", "share.js", "boot-rescue.js", "pin-fix.js", "share-fix.js", "home-head.js", "search-ui.js", "detail-polish.js", "sheet-fix.js", "me-polish.js"].forEach((name) => {
    const id = "yycj-" + name.replace(".js", "");
    if (document.getElementById(id)) return;
    const s = document.createElement("script");
    s.id = id;
    s.src = "./" + name + "?v=20260911bc";
    document.head.appendChild(s);
  });
})();
