(() => {
  const st = document.getElementById("yycj-me-css") || document.createElement("style");
  st.id = "yycj-me-css";
  st.textContent = `#view-me{padding-bottom:24px;}
#view-me .card{border-radius:16px;padding:14px 16px;margin:0 0 10px;}
#view-me h3{margin:0 0 10px;font-size:1rem;letter-spacing:.02em;}
#view-me .row{gap:8px;}
#meCredit{display:flex;align-items:center;justify-content:space-between;}
#meCredit .score{font-size:1.4rem;font-weight:700;color:#d7c28a;}
#guestNick{height:38px;}
#view-me [data-switch]{flex:1;text-align:center;}
#view-me [data-switch].on{background:#2a3348;border-color:#6f8cff;}
#meGuide{display:none!important;}`;
  document.head.appendChild(st);

  function polish() {
    document.getElementById("meGuide")?.remove();
    document.querySelectorAll("#view-me h3").forEach((h) => {
      if (h.textContent.trim() === "我的身份") h.textContent = "我的昵称";
    });
    const meCard = document.getElementById("meCard");
    if (meCard && /身份|角色/.test(meCard.textContent) && meCard.dataset.polished !== "1") {
      const user = JSON.parse(localStorage.getItem("yycj_user") || "{}");
      const map = { guest: "客人", teacher: "老师", merchant: "商家" };
      const name = user.alias || user.full_name || user.username || "未设置";
      meCard.dataset.polished = "1";
      meCard.innerHTML = `<div class="muted">当前身份 · ${map[user.role] || "客人"}</div><h3 style="margin:4px 0 0">${name}</h3>`;
    }
  }
  document.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-nav='me']")) setTimeout(polish, 80);
  });
  setTimeout(polish, 400);
  setInterval(polish, 1500);
})();
