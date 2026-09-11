(() => {
  function play() {
    document.querySelectorAll("#detail video, .gallery-hero video").forEach((v) => {
      v.muted = true;
      v.loop = true;
      v.autoplay = true;
      v.setAttribute("playsinline", "");
      v.setAttribute("webkit-playsinline", "");
      v.play().catch(() => {});
    });
  }
  setInterval(play, 900);
  document.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-id], .g-thumb")) setTimeout(play, 400);
  });
})();
