(() => {
  const BG = "#0b1020";
  const root = document.documentElement;
  const body = document.body;
  root.style.background = BG;
  if (body) body.style.background = BG;
  const tg = window.Telegram && window.Telegram.WebApp;
  try {
    tg?.setBackgroundColor?.(BG);
    tg?.setHeaderColor?.(BG);
    tg?.expand?.();
  } catch (e) {}
  function viewportH() {
    if (window.visualViewport && window.visualViewport.height) return window.visualViewport.height;
    return window.innerHeight || 0;
  }
  function apply() {
    const h = Math.max(240, Math.round(viewportH()));
    root.style.setProperty("--app-h", h + "px");
    ["app", "boot", "gate"].forEach((id) => {
      const el = document.getElementById(id);
      if (el) {
        el.style.minHeight = "0";
        el.style.height = h + "px";
        el.style.maxHeight = h + "px";
        el.style.overflow = "auto";
      }
    });
    if (body) {
      body.style.height = h + "px";
      body.style.overflow = "hidden";
    }
  }
  apply();
  window.visualViewport?.addEventListener("resize", apply);
  window.visualViewport?.addEventListener("scroll", apply);
  window.addEventListener("resize", apply);
  document.addEventListener("focusin", (ev) => {
    if (!ev.target || !/INPUT|TEXTAREA|SELECT/.test(ev.target.tagName)) return;
    apply();
    setTimeout(() => {
      apply();
      try { ev.target.scrollIntoView({ block: "center", inline: "nearest" }); } catch (e) {}
    }, 50);
    setTimeout(apply, 300);
  });
  document.addEventListener("focusout", () => setTimeout(apply, 80));
})();
