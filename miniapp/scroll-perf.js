(() => {
  if (!document.getElementById("yycj-scroll-perf-css")) {
    const l = document.createElement("link");
    l.id = "yycj-scroll-perf-css";
    l.rel = "stylesheet";
    l.href = "./scroll-perf.css?v=20260911at";
    document.head.appendChild(l);
  }
})();
