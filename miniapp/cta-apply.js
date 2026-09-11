(() => {
  if (window.__yycjCtaApply) return;
  window.__yycjCtaApply = true;
  function settings() {
    return window.__yycjHome || {};
  }
  function label() {
    return String(settings().chat_cta_label || "想聊聊").slice(0, 32);
  }
  function shown() {
    const v = settings().show_chat_cta;
    return !(v === false || v === 0 || v === "0" || v === "false");
  }
  function apply() {
    const text = label();
    const on = shown();
    document.querySelectorAll("#detailChat, [data-cta='chat']").forEach((btn) => {
      if (on && btn.textContent !== text) btn.textContent = text;
      btn.hidden = !on;
      btn.style.display = on ? "" : "none";
    });
  }
  async function load() {
    const token = localStorage.getItem("yycj_token") || "";
    if (!token) return;
    try {
      const r = await fetch("/api/home?limit=1", { headers: { Authorization: "Bearer " + token } });
      const data = await r.json();
      window.__yycjHome = Object.assign({}, window.__yycjHome || {}, data);
      apply();
    } catch (e) {}
  }
  load();
  setTimeout(load, 800);
  setTimeout(load, 2000);
  const detail = document.getElementById("detail");
  if (detail) new MutationObserver(apply).observe(detail, { childList: true });
  document.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-id]")) setTimeout(apply, 200);
  });
})();
