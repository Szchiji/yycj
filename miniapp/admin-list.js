(() => {
  if (window.__yycjAdminList) return;
  window.__yycjAdminList = true;
  const token = () => localStorage.getItem("yycj_token") || "";
  async function call(path, body) {
    const r = await fetch(path, {
      method: "POST",
      headers: { Authorization: "Bearer " + token(), "Content-Type": "application/json" },
      body: JSON.stringify(body || {}),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.detail || r.statusText || "请求失败");
    return data;
  }
  document.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("[data-list]");
    if (!btn) return;
    ev.preventDefault();
    ev.stopPropagation();
    const id = btn.getAttribute("data-id");
    const act = btn.getAttribute("data-list");
    if (!id || !act) return;
    try {
      btn.disabled = true;
      if (act === "renew") {
        const raw = prompt("续期天数", "30");
        if (raw == null) return;
        const days = parseInt(raw, 10);
        if (!days || days < 1) return alert("请输入有效天数");
        await call("/api/admin/listings/" + encodeURIComponent(id) + "/renew", { days });
        alert("已续期 " + days + " 天");
      } else if (act === "unlist") {
        await call("/api/admin/listings/" + encodeURIComponent(id) + "/unlist", { reason: "admin" });
        alert("已下架");
      } else if (act === "relist") {
        await call("/api/admin/listings/" + encodeURIComponent(id) + "/relist", {});
        alert("已重新上架");
      } else return;
      document.getElementById("btnRefresh")?.click();
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      btn.disabled = false;
    }
  }, true);
})();
