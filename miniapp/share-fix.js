(() => {
  function place() {
    const box = document.getElementById("detail");
    if (!box) return;
    let btn = document.getElementById("detailShare");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "detailShare";
      btn.className = "btn";
      btn.type = "button";
      btn.textContent = "分享";
    }
    const lamp = box.getAttribute("data-lamp") || box.getAttribute("data-id") || "";
    if (lamp) btn.setAttribute("data-share", lamp);
    const chat = box.querySelector("#detailChat");
    const row = chat && chat.parentElement;
    if (row && btn.parentElement !== row) row.appendChild(btn);
  }
  const box = document.getElementById("detail");
  if (box) new MutationObserver(place).observe(box, { childList: true, subtree: true });
  document.addEventListener("click", (ev) => {
    const card = ev.target.closest("#feed [data-id], #pins [data-id], #favList [data-id]");
    if (card) {
      const d = document.getElementById("detail");
      if (d) d.setAttribute("data-lamp", card.getAttribute("data-id") || "");
      setTimeout(place, 50);
      setTimeout(place, 400);
    }
  });
  setInterval(place, 800);
})();
