(() => {
  let ms = 4000;
  let timer = 0;
  function step() {
    const pins = document.getElementById("pins");
    if (!pins || pins.classList.contains("hidden") || !pins.querySelector(".pin-card")) {
      timer = setTimeout(step, ms);
      return;
    }
    if (pins.dataset.userScroll === "1") {
      pins.dataset.userScroll = "0";
      timer = setTimeout(step, ms);
      return;
    }
    const card = pins.querySelector(".pin-card");
    const w = card ? card.getBoundingClientRect().width + 10 : 160;
    if (pins.scrollLeft + pins.clientWidth >= pins.scrollWidth - 16) pins.scrollTo({ left: 0, behavior: "smooth" });
    else pins.scrollBy({ left: w, behavior: "smooth" });
    timer = setTimeout(step, ms);
  }
  async function read() {
    try {
      const r = await fetch("/api/home?limit=1", { headers: { Authorization: "Bearer " + (localStorage.getItem("yycj_token") || "") } });
      const data = await r.json();
      const sec = Number(data.carousel_interval_sec || 4);
      ms = Math.max(2, Math.min(20, sec || 4)) * 1000;
    } catch (e) {}
  }
  document.getElementById("pins")?.addEventListener("touchstart", () => {
    const pins = document.getElementById("pins");
    if (pins) pins.dataset.userScroll = "1";
  }, { passive: true });
  window.__yycjStopOldCarousel = true;
  read().then(() => { clearTimeout(timer); step(); });
  setInterval(read, 30000);
})();
