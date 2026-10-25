(() => {
  if (window.__yycjAdminGo) return;
  window.__yycjAdminGo = true;
  const DESK = "./desk.html?v=20260925b";
  let isAdmin = null;
  let pending = null;
  function go(ev) {
    const t = ev.target.closest("#adminEntry, #adminEntry a, a[href*='admin.html'], a[href*='console.html']");
    if (!t) return;
    ev.preventDefault();
    ev.stopPropagation();
    location.href = DESK;
  }
  function paint(admin) {
    const entry = document.getElementById("adminEntry");
    const a = entry && entry.querySelector("a");
    if (a) {
      a.setAttribute("href", DESK);
      a.textContent = "管理后台";
    }
    if (entry && admin) entry.classList.remove("hidden");
  }
  function check() {
    if (pending) return pending;
    pending = (async () => {
      try {
        const token = localStorage.getItem("yycj_token") || "";
        const r = await fetch("/api/me", { headers: { Authorization: "Bearer " + token } });
        const data = await r.json();
        isAdmin = !!data.is_admin;
      } catch (e) {
        isAdmin = false;
      }
      paint(isAdmin);
      return isAdmin;
    })().finally(() => { pending = null; });
    return pending;
  }
  function toast(msg) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
    el.classList.remove("err");
    setTimeout(() => el.classList.add("hidden"), 3600);
  }
  function openUrl(url) {
    const s = String(url || "").trim();
    if (!s) return false;
    const tg = window.Telegram && window.Telegram.WebApp;
    try {
      if (tg && /t\.me\/|tg:\/\//i.test(s) && tg.openTelegramLink) tg.openTelegramLink(s);
      else if (tg && tg.openLink) tg.openLink(s);
      else location.href = s;
      return true;
    } catch (e) {
      return false;
    }
  }
  // Top-left 管理员 link (#topAdmin): previously had no handler (its only binding lived in the
  // never-loaded home-head script, now removed). Admins go to the console (same-origin relative URL keeps auth);
  // others are sent to the configured admin contact.
  async function topAdmin(ev) {
    if (!ev.target.closest("#topAdmin")) return;
    ev.preventDefault();
    ev.stopPropagation();
    const admin = isAdmin === null ? await check() : isAdmin;
    if (admin) { location.href = DESK; return; }
    const contacts = (window.__yycjHomeData && window.__yycjHomeData.contacts) || {};
    if (!openUrl(contacts.admin_url)) toast("后台还没填管理员联系");
  }
  document.addEventListener("click", go, true);
  document.addEventListener("click", topAdmin, true);
  document.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-nav='me']")) check();
  });
  setTimeout(check, 900);
})();
