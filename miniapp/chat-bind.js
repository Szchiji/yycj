(() => {
  if (window.__yycjChatBind) return;
  window.__yycjChatBind = true;
  const token = () => localStorage.getItem("yycj_token") || "";
  function toast(msg, err) {
    const el = document.getElementById("toast");
    if (!el) return alert(msg);
    el.textContent = msg || "";
    el.classList.toggle("hidden", !msg);
    el.classList.toggle("err", !!err);
    if (msg) setTimeout(() => el.classList.add("hidden"), 3600);
  }
  document.addEventListener("click", (ev) => {
    const card = ev.target.closest("#feed [data-id], #pins [data-id], #favList [data-id]");
    if (card) window.__yycjOpenLamp = card.getAttribute("data-id") || "";
  }, true);
  document.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("#detailChat");
    if (!btn) return;
    ev.preventDefault();
    ev.stopPropagation();
    const id = window.__yycjOpenLamp || btn.getAttribute("data-lamp") || "";
    if (!id) return toast("找不到这条资料", true);
    btn.disabled = true;
    try {
      const r = await fetch("/api/sessions/request", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() },
        body: JSON.stringify({ lamp_id: id }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.detail || data.message || "发起失败");
      toast(data.message || "已发送想聊聊，对方会在机器人里收到邀请");
    } catch (e) {
      toast(e.message || String(e), true);
    } finally {
      btn.disabled = false;
    }
  }, true);
})();
