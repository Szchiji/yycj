(() => {
  // 写评价：点星打分（替代数字框，数值仍写回 #revStars）+ 最多 3 张晒图（/api/media/upload?purpose=review）。
  if (window.__yycjReviewKit) return;
  window.__yycjReviewKit = true;
  const MAX = 3;
  const LABELS = ["", "很差", "一般", "还行", "满意", "超赞"];
  let photos = [];
  let busy = 0;
  const token = () => localStorage.getItem("yycj_token") || "";
  const $ = (s) => document.querySelector(s);
  function toast(msg) {
    const t = document.getElementById("toast");
    if (t) { t.textContent = msg; t.classList.remove("hidden"); clearTimeout(t._rk); t._rk = setTimeout(() => t.classList.add("hidden"), 2200); }
  }
  function paintStars() {
    const box = $("#rkStars");
    const inp = $("#revStars");
    if (!box || !inp) return;
    const v = Math.max(1, Math.min(5, parseInt(inp.value, 10) || 5));
    box.querySelectorAll("[data-star]").forEach((b) => {
      const on = Number(b.getAttribute("data-star")) <= v;
      b.classList.toggle("on", on);
      b.setAttribute("aria-checked", Number(b.getAttribute("data-star")) === v ? "true" : "false");
    });
    const l = $("#rkStarLbl");
    if (l) l.textContent = LABELS[v];
  }
  function paintPhotos() {
    const box = $("#rkPhotos");
    if (!box) return;
    const cells = photos.map((p, i) => `<div class="rk-ph"><img src="${p.preview}" alt="" /><button type="button" class="rk-x" data-rk-del="${i}" aria-label="删除">×</button></div>`);
    if (photos.length + busy < MAX) cells.push(`<label class="rk-add${busy ? " busy" : ""}"><input type="file" accept="image/*" multiple hidden id="rkFile" /><span>${busy ? "上传中…" : "+ 晒图"}</span><i>${photos.length}/${MAX}</i></label>`);
    else if (busy) cells.push(`<div class="rk-add busy"><span>上传中…</span></div>`);
    box.innerHTML = cells.join("");
  }
  async function upload(files) {
    const list = [...files].slice(0, MAX - photos.length);
    if (!list.length) return;
    busy = list.length;
    paintPhotos();
    try {
      const fd = new FormData();
      list.forEach((f) => fd.append("files", f));
      const r = await fetch("/api/media/upload?purpose=review", { method: "POST", headers: { Authorization: "Bearer " + token() }, body: fd });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.detail || "上传失败");
      (d.items || []).forEach((it) => { if (photos.length < MAX) photos.push({ url: it.url || it.file_id, preview: it.preview_url || "" }); });
    } catch (e) {
      toast(e.message || "上传失败");
    } finally {
      busy = 0;
      paintPhotos();
    }
  }
  function mount() {
    const form = $("#reviewForm");
    const inp = $("#revStars");
    if (!form || !inp || $("#rkStars")) return;
    inp.classList.add("rk-hide");
    inp.setAttribute("aria-hidden", "true");
    inp.tabIndex = -1;
    const stars = document.createElement("div");
    stars.id = "rkStars";
    stars.className = "rk-stars";
    stars.setAttribute("role", "radiogroup");
    stars.setAttribute("aria-label", "打分");
    stars.innerHTML = [1, 2, 3, 4, 5].map((n) => `<button type="button" role="radio" data-star="${n}" aria-label="${n} 星">★</button>`).join("") + `<span id="rkStarLbl" class="rk-lbl"></span>`;
    inp.insertAdjacentElement("afterend", stars);
    const txt = $("#revText");
    if (txt && !txt.placeholder) txt.placeholder = "说说体验（准时、环境、态度…）";
    const ph = document.createElement("div");
    ph.id = "rkPhotos";
    ph.className = "rk-photos";
    (txt || stars).insertAdjacentElement("afterend", ph);
    paintStars();
    paintPhotos();
  }
  document.addEventListener("click", (ev) => {
    const s = ev.target.closest && ev.target.closest("#rkStars [data-star]");
    if (s) { const inp = $("#revStars"); if (inp) inp.value = s.getAttribute("data-star"); paintStars(); return; }
    const del = ev.target.closest && ev.target.closest("[data-rk-del]");
    if (del) { photos.splice(Number(del.getAttribute("data-rk-del")), 1); paintPhotos(); }
  });
  document.addEventListener("change", (ev) => { if (ev.target && ev.target.id === "rkFile") upload(ev.target.files || []); });
  window.__yycjRevPhotos = () => photos.map((p) => p.url).filter(Boolean);
  window.__yycjRevReset = () => { window.__yycjRevDoneMsg = photos.length ? "评价已提交，带图评价需管理员审核后展示" : ""; photos = []; const inp = $("#revStars"); if (inp) inp.value = "5"; const t = $("#revText"); if (t) t.value = ""; paintStars(); paintPhotos(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
