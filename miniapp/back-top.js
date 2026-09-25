(() => {
  ["publish-hours.js", "shop-badge.js", "publish-edit-fix.js"].forEach((name) => {
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
    const admin = document.querySelector(".admin-main, #console");
    if (admin && admin.scrollHeight > admin.clientHeight + 40) return admin;
    const main = document.getElementById("main");
    if (main && main.scrollHeight > main.clientHeight + 40) return main;
    return document.scrollingElement || document.documentElement;
  }
  function tick() {
    const el = scroller();
    const y = el.scrollTop || window.scrollY || 0;
    btn.style.display = y > Math.max(160, (el.clientHeight || 400) * 0.45) ? "block" : "none";
  }
  btn.onclick = () => {
    const el = scroller();
    if (el.scrollTo) el.scrollTo({ top: 0, behavior: "smooth" });
    else window.scrollTo({ top: 0, behavior: "smooth" });
  };
  window.addEventListener("scroll", tick, { passive: true });
  document.querySelector(".admin-main")?.addEventListener("scroll", tick, { passive: true });
  document.getElementById("main")?.addEventListener("scroll", tick, { passive: true });
  document.getElementById("console")?.addEventListener("scroll", tick, { passive: true });
  setInterval(tick, 600);
})();
