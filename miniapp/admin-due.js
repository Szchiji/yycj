(() => {
  if (!document.getElementById("yycj-preview")) {
    const s = document.createElement("script");
    s.id = "yycj-preview";
    s.src = "./admin-preview.js?v=20260925a";
    document.head.appendChild(s);
  }
  if (window.__yycjAdminDue) return;
  window.__yycjAdminDue = true;
  const token = () => localStorage.getItem("yycj_token") || "";
  const ST = { active: "已上架", hidden: "已下架", pending: "待审" };
  function esc(t) {
    return String(t ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&","<":"<",">":">",'"':'"',"'":"&#39;" }[c]));
  }
  function dueText(x) {
    if (x.days_left == null) return "无截止";
    if (x.days_left < 0) return "已过期 " + Math.abs(x.days_left) + " 天";
    if (x.days_left === 0) return "今天到期";
    return "剩 " + x.days_left + " 天";
  }
  async function paint() {
    const box = document.getElementById("adminListings");
    if (!box) return;
    try {
      const r = await fetch("/api/admin/listings", { headers: { Authorization: "Bearer " + token() } });
      const data = await r.json();
      const items = data.items || [];
      window.__yycjListings = items;
      box.innerHTML = items.map((x) => `
        <div class="pick-item">
          <div class="meta">
            <strong>${esc(x.title || "")}</strong>
            <div class="muted">${esc(x.city || "")} · ${ST[x.status] || x.status} · ${dueText(x)}</div>
          </div>
          <div class="row">
            <button class="btn" data-fill-proxy="${esc(x.lamp_id)}">代改</button>
            <button class="btn" data-list="renew" data-id="${esc(x.lamp_id)}">续期</button>
            <button class="btn" data-list="relist" data-id="${esc(x.lamp_id)}">重新上架</button>
            <button class="btn danger" data-list="unlist" data-id="${esc(x.lamp_id)}">下架</button>
          </div>
        </div>`).join("") || "<p class='muted'>暂无资料</p>";
    } catch (e) {}
  }
  document.addEventListener("click", async (ev) => {
    const unlock = ev.target.closest("[data-unlock-role]");
    if (unlock) {
      ev.preventDefault();
      try {
        await fetch("/api/admin/users/unlock-role", {
          method: "POST",
          headers: { Authorization: "Bearer " + token(), "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: parseInt(unlock.getAttribute("data-unlock-role"), 10) }),
        });
        alert("已解锁该用户角色");
      } catch (e) { alert("解锁失败"); }
    }
  }, true);
  const orig = document.getElementById("adminUsers");
  if (orig) {
    const mo = new MutationObserver(() => {
      orig.querySelectorAll(".pick-item .row").forEach((row) => {
        if (row.querySelector("[data-unlock-role]")) return;
        const ban = row.querySelector("[data-id]");
        if (!ban) return;
        const b = document.createElement("button");
        b.className = "btn";
        b.setAttribute("data-unlock-role", ban.getAttribute("data-id"));
        b.textContent = "解锁角色";
        row.appendChild(b);
      });
    });
    mo.observe(orig, { childList: true, subtree: true });
  }
  setTimeout(paint, 1800);
  setTimeout(paint, 3200);
  document.getElementById("btnRefresh")?.addEventListener("click", () => setTimeout(paint, 400));
  window.yycjLoadListings = paint;
})();
