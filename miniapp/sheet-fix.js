(() => {
  const TUTORIAL = [
    "右上角选城市，首页只看当前城。",
    "点轮播或卡片进详情，下方缩略图可切换。",
    "客人可收藏、分享、想聊聊；老师/商家在上架提交资料。",
    "分享链接发给好友后，先进机器人再点「打开资料」。",
    "想聊聊是匿名会话，会显示代称。",
    "兰花令是口碑分，详情里可看说明。",
  ];
  const st = document.getElementById("yycj-sheet-css") || document.createElement("style");
  st.id = "yycj-sheet-css";
  st.textContent = `.sheet{z-index:120!important;align-items:flex-end;}
.sheet-panel{margin-bottom:78px!important;max-height:70vh;overflow:auto;-webkit-overflow-scrolling:touch;}
#homeSearch,.search-row{display:flex;align-items:center;gap:6px;}
#homeSearch input,.search-row input{flex:1;min-width:0;height:36px;margin:0;}
#btnGuide{
  flex:none;margin:0;height:36px;padding:0 10px;
  border-radius:18px;border:1px solid #3a4668;
  background:#1a2340;color:#c9d4ff;
  font-size:.8rem;line-height:36px;white-space:nowrap;
}
#btnSearchClear,#btnSearch{
  height:36px;padding:0 12px;font-size:.8rem;white-space:nowrap;
}`;
  document.head.appendChild(st);

  function closeSheet(id) { document.getElementById(id)?.classList.add("hidden"); }
  function openSheet(id) { document.getElementById(id)?.classList.remove("hidden"); }

  let guide = document.getElementById("guideSheet");
  if (!guide) {
    guide = document.createElement("div");
    guide.id = "guideSheet";
    guide.className = "sheet hidden";
    guide.innerHTML = `<div class="sheet-panel">
      <h3>操作教程</h3>
      <ul>${TUTORIAL.map((x) => `<li>${x}</li>`).join("")}</ul>
      <button class="btn block primary" id="guideClose" type="button">知道了</button>
    </div>`;
    document.body.appendChild(guide);
  }

  const row = document.getElementById("homeSearch") || document.querySelector(".search-row");
  let btn = document.getElementById("btnGuide");
  if (!btn) {
    btn = document.createElement("button");
    btn.id = "btnGuide";
    btn.type = "button";
  }
  btn.className = "btn";
  btn.textContent = "教程";
  if (row) row.insertBefore(btn, row.firstChild);

  document.addEventListener("click", (ev) => {
    if (ev.target.id === "btnGuide") { ev.preventDefault(); openSheet("guideSheet"); }
    if (ev.target.id === "guideClose" || ev.target.id === "guideSheet") closeSheet("guideSheet");
    if (ev.target.id === "rulesClose" || ev.target.id === "rulesSheet") closeSheet("rulesSheet");
  });
})();
