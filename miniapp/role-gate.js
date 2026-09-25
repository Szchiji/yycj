(() => {
  if (window.__yycjRoleGate) return;
  window.__yycjRoleGate = true;
  const ROLES = [
    ["guest", "客人"],
    ["teacher", "老师"],
    ["merchant", "商家"],
  ];
  function gate() { return document.getElementById("gate"); }
  function paint() {
    const el = gate();
    if (!el || el.dataset.ready === "1") return;
    el.dataset.ready = "1";
    el.innerHTML = `<div class="card" style="margin:16px">
      <h2 style="margin:0 0 8px">先选身份</h2>
      <p class="muted">选好后至少一周才能换角色。昵称会显示在想聊聊里。</p>
      <label>昵称</label>
      <input id="gateNick" maxlength="16" placeholder="2-16 个字" />
      <div id="gateRoles" class="row" style="flex-wrap:wrap;margin:12px 0"></div>
      <p id="gateHint" class="muted"></p>
    </div>`;
    const box = document.getElementById("gateRoles");
    ROLES.forEach(([id, label]) => {
      const b = document.createElement("button");
      b.className = "btn primary";
      b.type = "button";
      b.dataset.role = id;
      b.textContent = label;
      box.appendChild(b);
    });
  }
  function lockInfo(user) {
    const raw = user && (user.role_locked_until || user.role_set_at);
    if (!raw) return { locked: false, days: 0 };
    const end = user.role_locked_until ? new Date(user.role_locked_until) : new Date(new Date(user.role_set_at).getTime() + 7 * 86400000);
    if (Number.isNaN(end.getTime())) return { locked: false, days: 0 };
    const left = end.getTime() - Date.now();
    if (left <= 0) return { locked: false, days: 0 };
    return { locked: true, days: Math.max(1, Math.ceil(left / 86400000)) };
  }
  function needGate(user) {
    if (!user) return true;
    if (!user.role) return true;
    if (!(user.guest_alias || "").trim()) return true;
    return false;
  }
  function showGate(on) {
    const g = gate();
    const app = document.getElementById("app");
    if (g) {
      g.classList.toggle("hidden", !on);
      g.setAttribute("aria-hidden", on ? "false" : "true");
    }
    if (app) app.classList.toggle("hidden", !!on);
  }
  async function api(path, opt) {
    const token = localStorage.getItem("yycj_token") || "";
    const r = await fetch(path, Object.assign({
      headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    }, opt || {}));
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.detail || "请求失败");
    return data;
  }
  async function refresh() {
    paint();
    try {
      const data = await api("/api/me");
      const user = data.user || {};
      localStorage.setItem("yycj_user", JSON.stringify(user));
      const nick = document.getElementById("gateNick");
      if (nick && user.guest_alias) nick.value = user.guest_alias;
      const lock = lockInfo(user);
      const hint = document.getElementById("gateHint");
      if (hint) hint.textContent = lock.locked ? ("当前身份一周内不可换，还剩 " + lock.days + " 天") : "";
      document.querySelectorAll("#view-me [data-switch]").forEach((b) => {
        b.disabled = !!lock.locked && !data.is_admin;
        b.title = lock.locked ? ("还剩 " + lock.days + " 天可换") : "";
      });
      if (needGate(user) && !data.is_admin) showGate(true);
    } catch (e) {}
  }
  document.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("#gate [data-role]");
    if (!btn) return;
    ev.preventDefault();
    const nick = (document.getElementById("gateNick")?.value || "").trim();
    if (nick.length < 2) return alert("请先填写昵称");
    try {
      btn.disabled = true;
      await api("/api/me/alias", { method: "POST", body: JSON.stringify({ alias: nick }) });
      await api("/api/me/role", { method: "POST", body: JSON.stringify({ role: btn.getAttribute("data-role") }) });
      showGate(false);
      document.getElementById("app")?.classList.remove("hidden");
      location.reload();
    } catch (e) {
      alert(e.message || String(e));
    } finally {
      btn.disabled = false;
    }
  }, true);
  document.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("#view-me [data-switch]");
    if (!btn) return;
    const user = JSON.parse(localStorage.getItem("yycj_user") || "{}");
    const lock = lockInfo(user);
    if (lock.locked) {
      ev.preventDefault();
      ev.stopPropagation();
      alert("角色一周内只能换一次，还剩 " + lock.days + " 天");
    }
  }, true);
  setTimeout(refresh, 400);
  setTimeout(refresh, 1600);
})();
