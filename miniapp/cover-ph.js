/* Fill empty covers with the listing's first character. Safe if home-ui already does it. */
(() => {
  if (window.__yycjCoverPh) return;
  window.__yycjCoverPh = true;
  function fill(el) {
    if (!el || el.querySelector(".ph-letter")) return;
    const card = el.closest("[data-id], .pin-card, .feed-card");
    const title = card && (card.querySelector("h3, b") || {}).textContent;
    const ch = String(title || "").replace(/置顶|惠/g, "").trim().slice(0, 1) || "·";
    const span = document.createElement("span");
    span.className = "ph-letter";
    span.textContent = ch;
    el.appendChild(span);
  }
  function scan(root) {
    (root || document).querySelectorAll(".thumb.ph, .pin-cover.ph").forEach(fill);
  }
  const obs = new MutationObserver((muts) => {
    for (const m of muts) m.addedNodes.forEach((n) => {
      if (n.nodeType !== 1) return;
      if (n.matches && n.matches(".thumb.ph, .pin-cover.ph")) fill(n);
      if (n.querySelectorAll) n.querySelectorAll(".thumb.ph, .pin-cover.ph").forEach(fill);
    });
  });
  function boot() {
    scan();
    ["#feed", "#pins", "#favList"].forEach((s) => {
      const el = document.querySelector(s);
      if (el) obs.observe(el, { childList: true, subtree: true });
    });
  }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
