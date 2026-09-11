(() => {
  if (window.__yycjDetailPolish) return;
  window.__yycjDetailPolish = true;
  const token = () => localStorage.getItem("yycj_token") || "";
  function tune(v) {
    if (!v || v.dataset.tuned) return;
    v.dataset.tuned = "1";
    v.muted = true;
    v.defaultMuted = true;
    v.autoplay = true;
    v.loop = true;
    v.controls = false;
    v.playsInline = true;
    v.preload = "auto";
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "");
    v.setAttribute("muted", "");
    v.play().catch(() => {});
  }
  function reviewsHtml(list) {
    if (!list || !list.length) return "<p class='muted'>暂无评价</p>";
    return list.map((t) => {
      const stars = "★".repeat(t.stars || 0) + "☆".repeat(Math.max(0, 5 - (t.stars || 0)));
      return `<div class="card" style="margin:8px 0"><div class="muted">${stars}</div><p>${String(t.text || "").replace(/[<>]/g,"")}</p></div>`;
    }).join("");
  }
  function paintReviews(data) {
    const detail = document.getElementById("detail");
    if (!detail) return;
    let box = document.getElementById("yycjReviews");
    if (!box) {
      box = document.createElement("div");
      box.id = "yycjReviews";
      detail.appendChild(box);
    }
    const list = (data && (data.reviews || data.approved_reviews)) || [];
    box.innerHTML = `<h3 style="font-size:1rem;margin:12px 0 6px">评价</h3>${reviewsHtml(list)}`;
  }
  async function loadReviews(id) {
    if (!id) return;
    try {
      const r = await fetch("/api/lamps/" + encodeURIComponent(id), {
        headers: { Authorization: "Bearer " + token() },
      });
      paintReviews(await r.json());
    } catch (e) {}
  }
  document.addEventListener("click", (ev) => {
    const card = ev.target.closest("#feed [data-id], #pins [data-id], #favList [data-id]");
    if (!card) return;
    setTimeout(() => loadReviews(card.getAttribute("data-id")), 200);
  }, true);
  const view = document.getElementById("view-detail");
  if (view) {
    new MutationObserver(() => {
      view.querySelectorAll("video").forEach(tune);
      document.querySelectorAll("#detail .media-grid").forEach((n) => { n.style.display = "none"; });
    }).observe(view, { childList: true, subtree: true });
  }
})();
