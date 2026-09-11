(() => {
  function posterOf(video) {
    if (video.getAttribute("poster")) return video.getAttribute("poster");
    const imgs = [...document.querySelectorAll("#detail .g-thumb img, #detail .gallery-hero img")];
    const src = imgs.map((i) => i.currentSrc || i.src || i.getAttribute("data-src")).find(Boolean);
    return src || "";
  }
  function arm(v) {
    if (!v || v.dataset.armed === "1") return;
    v.dataset.armed = "1";
    const poster = posterOf(v);
    if (poster && !v.getAttribute("poster")) v.setAttribute("poster", poster);
    v.muted = true;
    v.defaultMuted = true;
    v.loop = true;
    v.autoplay = true;
    v.playsInline = true;
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "");
    v.removeAttribute("controls");
    v.controls = false;
    const tryPlay = () => v.play().catch(() => {});
    tryPlay();
    v.addEventListener("pause", () => { if (!v.dataset.userPause) tryPlay(); });
    v.addEventListener("click", (ev) => {
      ev.stopPropagation();
      if (v.paused) { v.dataset.userPause = ""; tryPlay(); }
      else { v.dataset.userPause = "1"; v.pause(); }
    });
  }
  function scan() {
    document.querySelectorAll("#detail video, .gallery-hero video").forEach(arm);
  }
  scan();
  setInterval(scan, 700);
  document.addEventListener("click", () => setTimeout(scan, 200));
})();
