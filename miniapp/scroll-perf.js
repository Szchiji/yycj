(() => {
  if (document.getElementById("yycj-scroll-perf-css")) return;
  const l = document.createElement("link");
  l.id = "yycj-scroll-perf-css";
  l.rel = "stylesheet";
  l.href = "./scroll-perf.css?v=20260911ar";
  document.head.appendChild(l);
  document.addEventListener("touchstart", () => {}, { passive: true });
})();
