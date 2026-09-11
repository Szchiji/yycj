(() => {
  if (window.__yycjCtaApply) return;
  window.__yycjCtaApply = true;
  function apply() {
    const s = window.__yycjHome || {};
    const label = String(s.chat_cta_label || "想聊聊").slice(0, 32);
    const on = s.show_chat_cta !== false;
    document.querySelectorAll("#detailChat, [data-cta='chat']").forEach((btn) => {
      if (btn.textContent !== label) btn.textContent = label;
      const next = on ? "" : "none";
      if (btn.style.display !== next) btn.style.display = next;
    });
  }
  async function load() {
    try {
      const token = localStorage.getItem("yycj_token") || "";
      const r = await fetch("/api/home?limit=1", { headers: { Authorization: "Bearer " + token } });
      window.__yycjHome = Object.assign({}, window.__yycjHome || {}, await r.json());
      apply();
    } catch (e) {}
  }
  load();
  document.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-id], #detailChat, #feed, #pins")) setTimeout(apply, 120);
  });
})();
