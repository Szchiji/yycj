(() => {
  const st = document.getElementById("yycj-home-lock") || document.createElement("style");
  st.id = "yycj-home-lock";
  st.textContent = `#feed:not(.has-cover),#pins:not(.ready){opacity:0;}
#feed.has-cover,#pins.ready{opacity:1;transition:opacity .15s linear;}`;
  document.head.appendChild(st);
  let html = "";
  let pinsHtml = "";
  let hold = false;
  function snap() {
    const feed = document.getElementById("feed");
    const pins = document.getElementById("pins");
    if (feed && feed.classList.contains("has-cover")) html = feed.innerHTML;
    if (pins && pins.querySelector(".pin-card")) {
      pinsHtml = pins.innerHTML;
      pins.classList.add("ready");
    }
  }
  function restore() {
    if (hold) return;
    const feed = document.getElementById("feed");
    const pins = document.getElementById("pins");
    if (feed && html && !feed.classList.contains("has-cover")) {
      hold = true;
      feed.classList.add("has-cover");
      feed.innerHTML = html;
      hold = false;
    }
    if (pins && pinsHtml && !pins.querySelector(".pin-card.short, .pin-cover")) {
      hold = true;
      pins.innerHTML = pinsHtml;
      pins.classList.add("ready");
      hold = false;
    }
  }
  const feed = document.getElementById("feed");
  const pins = document.getElementById("pins");
  if (feed) new MutationObserver(() => { snap(); restore(); }).observe(feed, { childList: true });
  if (pins) new MutationObserver(() => { snap(); restore(); }).observe(pins, { childList: true });
  setInterval(snap, 800);
})();
