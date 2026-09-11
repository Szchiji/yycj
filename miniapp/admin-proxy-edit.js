(() => {
  const token = () => localStorage.getItem("yycj_token") || "";
  async function findItem(id) {
    const r = await fetch("/api/admin/listings", { headers: { Authorization: "Bearer " + token() } });
    const data = await r.json();
    return (data.items || []).find((x) => x.lamp_id === id);
  }
  function decorate() {
    const box = document.getElementById("adminListings");
    if (!box) return;
    box.querySelectorAll(".pick-item").forEach((card) => {
      if (card.querySelector("[data-fill-proxy]")) return;
      const unlist = card.querySelector("[data-list='unlist']");
      const id = unlist && unlist.getAttribute("data-id");
      if (!id || !unlist.parentElement) return;
      const btn = document.createElement("button");
      btn.className = "btn";
      btn.type = "button";
      btn.textContent = "代改";
      btn.setAttribute("data-fill-proxy", id);
      unlist.parentElement.insertBefore(btn, unlist.parentElement.firstChild);
    });
  }
  document.getElementById("adminListings")?.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("[data-fill-proxy]");
    if (!btn) return;
    ev.preventDefault();
    ev.stopPropagation();
    try {
      const item = await findItem(btn.getAttribute("data-fill-proxy"));
      if (item && window.yycjFillProxy) window.yycjFillProxy(item);
    } catch (e) { alert(e.message || String(e)); }
  });
  const box = document.getElementById("adminListings");
  if (box) new MutationObserver(decorate).observe(box, { childList: true });
  setTimeout(decorate, 2000);
})();
