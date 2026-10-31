(() => {
  // 写评价：点星打分（数值写回 #revStars）+ 最多 3 张晒图 + 提交（加载状态、成功/失败一定有提示）。
  if (window.__yycjReviewKit) return;
  window.__yycjReviewKit = true;
  const MAX = 3;
  const LABELS = ["", "很差", "一般", "还行", "满意", "超赞"];
  let photos = [];
  let busy = 0;
  let sending = false;
  const token = () => localStorage.getItem("yycj_token") || "";
  const $ = (s) => document.querySelector(s);
  function report(ev, extra) { try { window.__yycjReport && window.__yycjReport(Object.assign({ ev }, extra || {})); } catch (e) {} }
  function toast(msg, err) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.remove("hidden");
    t.classList.toggle("err", !!err);
    clearTimeout(t._rk);
    t._rk = setTimeout(() => t.classList.add("hidden"), err ? 4000 : 2800);
  }
  // message line inside the form, right under the submit button: visible even if a toast is missed
  function say(msg, kind) {
    const el = $("#rkMsg");
    if (!el) return;
    el.textContent = msg || "";
    el.className = "rk-msg" + (kind ? " " + kind : "");
  }
  function paintStars() {
    const box = $("#rkStars");
    const inp = $("#revStars");
    if (!box || !inp) return;
    const v = Math.max(1, Math.min(5, parseInt(inp.value, 10) || 5));
    box.querySelectorAll("[data-star]").forEach((b) => {
      b.classList.toggle("on", Number(b.getAttribute("data-star")) <= v);
      b.setAttribute("aria-checked", Number(b.getAttribute("data-star")) === v ? "true" : "false");
    });
    const l = $("#rkStarLbl");
    if (l) l.textContent = LABELS[v];
  }
  function paintPhotos() {
    const box = $("#rkPhotos");
    if (!box) return;
    const cells = photos.map((p, i) => `<div class="rk-ph"><img src="${p.preview}" alt="" /><button type="button" class="rk-x" data-rk-del="${i}" aria-label="删除">×</button></div>`);
    if (busy) cells.push(`<div class="rk-add busy"><span>上传中…</span></div>`);
    else if (photos.length < MAX) cells.push(`<label class="rk-add"><input type="file" accept="image/*" multiple hidden id="rkFile" /><span>+ 晒图</span><i>${photos.length}/${MAX}</i></label>`);
    box.innerHTML = cells.join("");
  }
  function paintBtn() {
    const btn = $("#reviewForm button[type=submit]");
    if (!btn) return;
    if (!btn.dataset.label) btn.dataset.label = btn.textContent;
    btn.disabled = sending;
    btn.classList.toggle("rk-sending", sending);
    btn.textContent = sending ? "提交中…" : btn.dataset.label;
  }
  // iPhone photos are often 3–12 MB: shrink to ≤1600px JPEG before upload (falls back to the original file)
  async function shrink(file) {
    try {
      if (!file || !/^image\//.test(file.type || "image/") || file.size < 600 * 1024) return file;
      const url = URL.createObjectURL(file);
      try {
        const img = await new Promise((ok, bad) => { const i = new Image(); i.onload = () => ok(i); i.onerror = bad; i.src = url; });
        const k = Math.min(1, 1600 / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
        const c = document.createElement("canvas");
        c.width = Math.max(1, Math.round(img.naturalWidth * k));
        c.height = Math.max(1, Math.round(img.naturalHeight * k));
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
        const blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", 0.85));
        if (!blob || blob.size >= file.size) return file;
        return new File([blob], (file.name || "photo").replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
      } finally { URL.revokeObjectURL(url); }
    } catch (e) { return file; }
  }
  async function upload(files) {
    const list = [...files].slice(0, MAX - photos.length);
    if (!list.length) return;
    busy = list.length;
    paintPhotos();
    say("");
    try {
      const fd = new FormData();
      for (const f of list) { const g = await shrink(f); fd.append("files", g, g.name || "photo.jpg"); }
      const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
      const tm = setTimeout(() => ctl && ctl.abort(), 60000);
      let r;
      try { r = await fetch("/api/media/upload?purpose=review", { method: "POST", headers: { Authorization: "Bearer " + token() }, body: fd, signal: ctl ? ctl.signal : undefined }); }
      finally { clearTimeout(tm); }
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof d.detail === "string" ? d.detail : "图片上传失败（" + r.status + "）");
      (d.items || []).forEach((it) => { if (photos.length < MAX) photos.push({ url: it.url || it.file_id, preview: it.preview_url || "" }); });
      if (!(d.items || []).length) throw new Error("图片上传失败，请换一张试试");
    } catch (e) {
      const m = e && e.name === "AbortError" ? "图片上传超时，请检查网络后重试" : (e && e.message) || "图片上传失败";
      toast(m, true); say(m, "err");
      report("review_upload_fail", { msg: String(m).slice(0, 120) });
    } finally {
      busy = 0;
      paintPhotos();
    }
  }
  function errText(status, detail) {
    const d = typeof detail === "string" ? detail : "";
    if (status === 403 && /客人/.test(d)) return "评价需以客人身份提交：请到「我的」切换为「客人」后再评价";
    if (status === 401) return "登录已过期，请关闭小程序后重新打开";
    if (status === 429) return "提交太频繁了，请稍后再试";
    if (status === 404) return "这条资料已下架，无法评价";
    if (status >= 500) return "服务器开小差了，评价没提交成功，请稍后重试";
    if (d) return "提交失败：" + d;
    return "提交失败（" + status + "），请重试";
  }
  async function submit(ctx) {
    if (sending) return;
    if (busy) { const m = "图片还在上传，请稍等几秒再提交"; toast(m, true); say(m, "err"); return; }
    const lamp = ($("#revLampId") && $("#revLampId").value) || "";
    if (!lamp) { const m = "没有找到要评价的资料，请返回重试"; toast(m, true); say(m, "err"); return; }
    sending = true; paintBtn(); say("");
    const pics = photos.map((p) => p.url).filter(Boolean);
    try {
      const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
      const tm = setTimeout(() => ctl && ctl.abort(), 20000);
      let r;
      try {
        r = await fetch("/api/reviews", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() },
          body: JSON.stringify({ lamp_id: lamp, stars: parseInt(($("#revStars") || {}).value, 10) || 5, text: (($("#revText") || {}).value || "").trim(), photos: pics }),
          signal: ctl ? ctl.signal : undefined,
        });
      } finally { clearTimeout(tm); }
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        const m = errText(r.status, d && d.detail);
        toast(m, true); say(m, "err");
        report("review_fail", { status: r.status, msg: String(m).slice(0, 120) });
        return;
      }
      const pending = (d.review && d.review.status) === "pending";
      const m = pending ? "已提交，需管理员审核后展示" : "评价已提交";
      reset();
      sending = false; paintBtn();
      toast(m);
      try { ctx && ctx.go && ctx.go("me"); } catch (e) {}
      try { ctx && ctx.refresh && (await ctx.refresh()); } catch (e) {}
    } catch (e) {
      const m = e && e.name === "AbortError" ? "网络超时，评价没提交成功，请重试" : "网络不稳定，评价没提交成功，请重试";
      toast(m, true); say(m, "err");
      report("review_fail", { status: 0, msg: String((e && e.message) || e).slice(0, 120) });
    } finally {
      sending = false; paintBtn();
    }
  }
  function reset() {
    photos = [];
    const inp = $("#revStars"); if (inp) inp.value = "5";
    const t = $("#revText"); if (t) t.value = "";
    say("");
    paintStars(); paintPhotos();
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
    const msg = document.createElement("div");
    msg.id = "rkMsg";
    msg.className = "rk-msg";
    msg.setAttribute("role", "status");
    msg.setAttribute("aria-live", "polite");
    form.appendChild(msg);
    paintStars();
    paintPhotos();
  }
  document.addEventListener("click", (ev) => {
    const s = ev.target.closest && ev.target.closest("#rkStars [data-star]");
    if (s) { const inp = $("#revStars"); if (inp) inp.value = s.getAttribute("data-star"); paintStars(); return; }
    const del = ev.target.closest && ev.target.closest("[data-rk-del]");
    if (del) { photos.splice(Number(del.getAttribute("data-rk-del")), 1); paintPhotos(); }
  });
  document.addEventListener("change", (ev) => {
    if (ev.target && ev.target.id === "rkFile") { const f = [...(ev.target.files || [])]; ev.target.value = ""; upload(f); }
  });
  window.__yycjSubmitReview = submit;
  window.__yycjRevPhotos = () => photos.map((p) => p.url).filter(Boolean);
  window.__yycjRevReset = reset;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount); else mount();
})();
