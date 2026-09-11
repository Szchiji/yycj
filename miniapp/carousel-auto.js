(() => {
  function tick() {
    const pins = document.getElementById("pins");
    if (!pins || !pins.querySelector(".pin-card")) return;
    const step = Math.round((pins.clientWidth || 300) * 0.82);
    if (pins.scrollLeft + pins.clientWidth >= pins.scrollWidth - 16) {
      pins.scrollTo({ left: 0, behavior: "smooth" });
    } else {
      pins.scrollBy({ left: step, behavior: "smooth" });
    }
  }
  setInterval(tick, 4000);
  if (!document.getElementById("yycj-carousel-auto")) {
    const s = document.createElement("script");
    s.id = "yycj-carousel-auto";
  }
})();
