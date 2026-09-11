(() => {
  ["detail-autoplay.js", "share.js", "admin-side.js"].forEach((name) => {
    const id = "yycj-" + name.replace(".js", "");
    if (document.getElementById(id)) return;
    const s = document.createElement("script");
    s.id = id;
    s.src = "./" + name + "?v=20260911aa";
    document.head.appendChild(s);
  });
  const style = document.createElement("style");
  style.textContent = `
    .share-btn {
      display:inline-block; margin-top:4px; font-size:11px; padding:2px 8px;
      border:1px solid #2a3348; border-radius:999px; background:transparent; color:#9db0d0;
    }
    #detailShare { margin:8px 0; }
  `;
  document.head.appendChild(style);
  function addDetailShare() {
    const box = document.getElementById("detail");
    if (!box || box.querySelector("#detailShare")) return;
    const btn = document.createElement("button");
    btn.id = "detailShare";
    btn.className = "btn share-btn";
    btn.type = "button";
    btn.setAttribute("data-share", "1");
    btn.textContent = "分享给电报好友";
    const card = box.querySelector(".card") || box;
    card.appendChild(btn);
  }
  setInterval(addDetailShare, 800);
})();
