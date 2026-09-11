(() => {
  const token = () => localStorage.getItem("yycj_token") || "";
  document.getElementById("topMeta")?.classList.add("hidden");
  function openUrl(url) {
    if (!url) return false;
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.openTelegramLink && /^https:\/\/t\.me\//i.test(url)) { tg.openTelegramLink(url); return true; }
    if (tg && tg.openLink) { tg.openLink(url); return true; }
    window.location.href = url;
    return true;
  }
  function toast(msg) {
    const el = document.getElementById("toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
    setTimeout(() => el.classList.add("hidden"), 1600);
  }
  function paintMe(home) {
    document.getElementById("meGuide")?.remove();
    document.getElementById("topMeta")?.classList.add("hidden");
    const user = (home && home.user) || JSON.parse(localStorage.getItem("yycj_user") || "{}");
    const roleMap = { guest: "客人", teacher: "老师", merchant: "商家" };
    let box = document.getElementById("meCredit");
    const meCard = document.getElementById("meCard");
    if (!box && meCard) {
      box = document.createElement("div");
      box.id = "meCredit";
      box.className = "card";
      meCard.parentElement.insertBefore(box, meCard);
    }
    if (box) {
      const score = user.lanhua_score != null ? user.lanhua_score : "-";
      const tier = user.tier || "";
      box.innerHTML = `<div><div class="muted">兰花令</div><div class="score">${score}</div></div><div class="muted">${roleMap[user.role] || "客人"}${tier ? " · " + tier : ""}</div>`;
    }
  }
  async function bind() {
    document.getElementById("topMeta")?.classList.add("hidden");
    const brand = document.getElementById("brandTitle");
    const admin = document.getElementById("topAdmin");
    let contacts = {}, home = {};
    try {
      const r = await fetch("/api/home?limit=1", { headers: { Authorization: "Bearer " + token() } });
      home = await r.json();
      contacts = home.contacts || {};
      if (home.user) localStorage.setItem("yycj_user", JSON.stringify(home.user));
    } catch (e) {}
    if (brand) {
      brand.style.cursor = "pointer";
      brand.onclick = (ev) => {
        ev.preventDefault();
        const url = contacts.bot_url || (contacts.bot_username ? ("https://t.me/" + String(contacts.bot_username).replace(/^@/, "")) : "");
        if (!openUrl(url)) toast("还没配置机器人");
      };
    }
    if (admin) {
      admin.textContent = contacts.admin_label || "管理员";
      admin.style.cursor = "pointer";
      admin.onclick = (ev) => {
        ev.preventDefault();
        if (home.is_admin) { location.href = "./admin.html"; return; }
        if (!openUrl(contacts.admin_url || "")) toast("后台还没填管理员联系");
      };
    }
    paintMe(home);
  }
  document.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-nav='me']")) setTimeout(bind, 200);
  });
  setTimeout(bind, 400);
})();
