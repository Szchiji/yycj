(() => {
  const box = document.getElementById("detail");
  if (!box) return;
  let last = "";
  function locFix() {
    box.querySelectorAll("p, li, span, div").forEach((n) => {
      if (n.closest(".gallery")) return;
      const t = (n.textContent || "").replace(/\s+/g, " ").trim();
      if (t.includes("·")) {
        const parts = t.split("·").map((s) => s.replace(/[\s📍📌]/g, "").trim()).filter(Boolean);
        const uniq = [];
        parts.forEach((p) => { if (p && !uniq.includes(p)) uniq.push(p); });
        if (uniq.length && uniq.length < parts.length) n.textContent = uniq.join(" · ");
      }
    });
    box.querySelectorAll(".media-grid").forEach((n) => { n.style.display = "none"; });
  }
  new MutationObserver(() => {
    const title = (box.querySelector("h3,h2") || {}).textContent || "";
    if (!document.getElementById("view-detail") || document.getElementById("view-detail").classList.contains("hidden")) return;
    locFix();
    if (!box.querySelector(".gallery-hero")) {
      const key = title + String(Date.now()).slice(0, -3);
      if (key !== last && window.openLamp) {
        const id = box.getAttribute("data-id") || last;
        if (id && id.length > 8) window.openLamp(id);
      }
    }
  }).observe(box, { childList: true, subtree: true });
})();
