(() => {
  ["publish-hours.js", "shop-badge.js"].forEach((name) => {
    if ([...document.scripts].some((s) => (s.src || "").indexOf(name) >= 0)) return;
    const el = document.createElement("script");
    el.src = "./" + name + "?v=20260925s";
    document.body.appendChild(el);
  });
  if (document.getElementById("yycjTop")) return;
  const btn = document.createElement("button");
  btn.id = "yycjTop";
  btn.type = "button";
  btn.textContent = "↑";
  btn.style.cssText = "position:fixed;right:14px;bottom:118px;width:36px;height:36px;border-radius:18px;border:1px solid #3a4668;background:rgba(18,24,40,.86);color:#d7e0ff;z-index:90;display:none;";
  document.body.appendChild(btn);
  function scroller() {
    const main = document.getElementById("main");
    if (main && main.scrollHeight > main.clientHeight + 40) return main;
    return document.scrollingElement || document.documentElement;
  }
  function tick() {
    const el = scroller();
    const y = el.scrollTop || window.scrollY || 0;
    btn.style.display = y > Math.max(180, (el.clientHeight || 400) * 0.6) ? "block" : "none";
  }
  btn.onclick = () => {
    const el = scroller();
    if (el === document.scrollingElement || el === document.documentElement) window.scrollTo({ top: 0, behavior: "smooth" });
    else el.scrollTo({ top: 0, behavior: "smooth" });
  };
  window.addEventListener("scroll", tick, { passive: true });
  document.getElementById("main")?.addEventListener("scroll", tick, { passive: true });
  setInterval(tick, 800);
})();
