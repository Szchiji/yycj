(() => {
  setInterval(() => {
    const pins = document.getElementById("pins");
    if (!pins || !pins.querySelector(".pin-card")) return;
    const step = Math.round((pins.clientWidth || 300) * 0.82);
    if (pins.scrollLeft + pins.clientWidth >= pins.scrollWidth - 16) {
      pins.scrollTo({ left: 0, behavior: "smooth" });
    } else {
      pins.scrollBy({ left: step, behavior: "smooth" });
    }
  }, 4000);
})();
