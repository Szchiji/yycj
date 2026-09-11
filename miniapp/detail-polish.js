(() => {
  function dedupe() {
    const box = document.getElementById("detail");
    if (!box) return;
    box.querySelectorAll(".muted").forEach((el) => {
      let t = el.textContent || "";
      if (!t.includes("附近") && !t.includes("·")) return;
      const parts = t.split("·").map((s) => s.trim()).filter(Boolean);
      const seen = new Set();
      const out = [];
      parts.forEach((p) => {
        const key = p.replace(/\s+/g, "");
        if (seen.has(key)) return;
        seen.add(key);
        out.push(p);
      });
      if (out.join(" · ") !== t.trim()) el.textContent = out.join(" · ");
    });
  }
  function tuneVideo(v) {
    if (!v) return;
    v.muted = true;
    v.defaultMuted = true;
    v.loop = true;
    v.autoplay = true;
    v.controls = false;
    v.playsInline = true;
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "");
    v.setAttribute("muted", "");
    v.preload = "auto";
    const go = () => v.play().catch(() => {});
    go();
    v.addEventListener("loadeddata", go, { once: true });
    v.addEventListener("canplay", go, { once: true });
  }
  function polish() {
    dedupe();
    document.querySelectorAll("#yycjGallery .gallery-hero video, #detail video").forEach(tuneVideo);
    document.querySelectorAll("#detail .media-grid").forEach((n) => { n.style.display = "none"; });
  }
  const box = document.getElementById("detail");
  if (box) new MutationObserver(polish).observe(box, { childList: true, subtree: true });
  const gal = document.getElementById("view-detail");
  if (gal) new MutationObserver(polish).observe(gal, { childList: true, subtree: true });
  setInterval(polish, 800);
})();
