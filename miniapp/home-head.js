(() => {
  const token = () => localStorage.getItem("yycj_token") || "";
  const DEFAULT_TUTORIAL = [
    "点右上角城市切换地区，首页只看当前城。",
    "点轮播或卡片进入详情，下方缩略图可切换，视频会自动播。",
    "客人可收藏、分享、想聊聊；老师/商家在「上架」提交资料。",
    "分享会复制链接，发给好友后先进机器人再看资料。",
    "想聊聊为匿名会话，会展示你的代称。",
    "兰花令是口碑分，评价和举报会影响分数。",
  ];
  function openUrl(url) {
    if (!url) return false;
    const tg = window.Telegram && window.Telegram.WebApp;
    if (tg && tg.openTelegramLink && /^https:\/\/t\.me\//i.test(url)) {
      tg.openTelegramLink(url);
      return true;
    }
    if (tg && tg.openLink) {
      tg.openLink(url);
      return true;
    }
    window.location.href = url;
    return true;
  }
  function toast(msg) {
    const el = document.getElementById("toast");
    if (!el) return alert(msg);
    el.textContent = msg;
    el.classList.remove("hidden");
    setTimeout(() => el.classList.add("hidden"), 1600);
  }
  function paintMe(home) {
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
      const role = roleMap[user.role] || "客人";
      const tier = user.tier || "";
      const score = user.lanhua_score != null ? user.lanhua_score : "";
      box.innerHTML = `<h3>兰花令</h3><p>${role} · ${tier}${score !== "" ? " · " + score + " 分" : ""}</p>`;
    }
    let guide = document.getElementById("meGuide");
    if (!guide) {
      const host = document.getElementById("view-me");
      if (!host) return;
      guide = document.createElement("div");
      guide.id = "meGuide";
      guide.className = "card";
      host.appendChild(guide);
    }
    const lines = (home && home.settings && home.settings.tutorial_text)
      ? String(home.settings.tutorial_text).split("\n").filter(Boolean)
      : DEFAULT_TUTORIAL;
    guide.innerHTML = `<h3>操作教程</h3><ol style="padding-left:18px;margin:8px 0;line-height:1.6">${lines.map((x) => `<li>${x}</li>`).join("")}</ol>`;
  }
  async function bind() {
    const brand = document.getElementById("brandTitle");
    const admin = document.getElementById("topAdmin");
    const meta = document.getElementById("topMeta");
    if (meta) meta.classList.add("hidden");
    let contacts = {};
    let home = {};
    try {
      const r = await fetch("/api/home?limit=1", { headers: { Authorization: "Bearer " + token() } });
      home = await r.json();
      contacts = home.contacts || {};
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
      const label = contacts.admin_label || "管理员";
      admin.textContent = label;
      admin.style.cursor = "pointer";
      admin.onclick = (ev) => {
        ev.preventDefault();
        const me = home.user || {};
        const url = contacts.admin_url || "";
        if (home.is_admin) {
          location.href = "./admin.html";
          return;
        }
        if (!openUrl(url)) toast("后台还没填管理员联系");
      };
    }
    paintMe(home);
  }
  document.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-nav='me']")) setTimeout(bind, 200);
  });
  setTimeout(bind, 600);
  setTimeout(bind, 1800);
})();
