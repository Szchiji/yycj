(() => {
  const seen = new WeakSet();
  const io = new IntersectionObserver((ents) => {
    ents.forEach((ent) => {
      if (!ent.isIntersecting) return;
      const el = ent.target;
      const src = el.getAttribute("data-src");
      const bg = el.getAttribute("data-bg");
      if (src) {
        el.src = src;
        el.removeAttribute("data-src");
      }
      if (bg) {
        el.style.backgroundImage = "url('" + bg.replace(/'/g, "%27") + "')";
        el.removeAttribute("data-bg");
      }
      io.unobserve(el);
    });
  }, { rootMargin: "240px 0px", threshold: 0.01 });
  function scan() {
    document.querySelectorAll("img[data-src], [data-bg]").forEach((el) => {
      if (seen.has(el)) return;
      seen.add(el);
      io.observe(el);
    });
    document.querySelectorAll("#detail video, .gallery-hero video").forEach((v) => {
      v.muted = true;
      v.loop = true;
      v.autoplay = true;
      v.setAttribute("playsinline", "");
      v.play().catch(() => {});
    });
  }
  scan();
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
})();
