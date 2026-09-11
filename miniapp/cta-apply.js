(() => {
  if (window.__yycjCtaApply) return;
  window.__yycjCtaApply = true;
  function apply() {
    const s = window.__yycjHome || {};
    const label = String(s.chat_cta_label || "想聊聊").slice(0, 32);
    const on = s.show_chat_cta !== false;
    document.querySelectorAll("#detailChat, [data-cta='chat']").forEach((btn) => {
      btn.textContent = label;
      btn.style.display = on ? "" : "none";
    });
  }
  async function load() {
    try {
      const token = localStorage.getItem("yycj_token") || "";
      const r = await fetch("/api/home?limit=1", { headers: { Authorization: "Bearer " + token } });
      const data = await r.json();
      window.__yycjHome = Object.assign({}, window.__yycjHome || {}, data);
      apply();
    } catch (e) {}
  }
  load();
  const view = document.getElementById("view-detail");
  if (view) new MutationObserver(apply).observe(view, { childList: true, subtree: true });
  document.addEventListener("click", () => setTimeout(apply, 80), true);
})();
