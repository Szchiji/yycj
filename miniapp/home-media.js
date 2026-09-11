(() => {
  function fix(img) {
    const s = img.getAttribute("src") || "";
    if (!s) return;
    if (s.startsWith("http") || s.startsWith("blob:") || s.startsWith("data:") || s.startsWith("/")) return;
    img.src = "/api/media/file/" + encodeURIComponent(s);
  }
  function scan() {
    document.querySelectorAll("#feed img, #pins img, #detail img, #pubPreview img").forEach(fix);
  }
  const obs = new MutationObserver(scan);
  obs.observe(document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: ["src"] });
  scan();
})();
