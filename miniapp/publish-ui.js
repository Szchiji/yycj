(() => {
  const $ = (s) => document.querySelector(s);
  const token = () => localStorage.getItem("yycj_token") || "";
  let uploaded = [];
  const FORM_MAP = { "称呼": "pubTitle", "城市": "pubCity", "简介": "pubDesc", "价位": "pubPrice", "区域": "pubDistrict", "大致位置": "pubApprox", "标签": "pubTags" };
  if (!document.getElementById("yycj-pub-css")) {
    const st = document.createElement("style");
    st.id = "yycj-pub-css";
    st.textContent = `#pubPreview{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:6px;margin:8px 0;}#pubPreview .up-thumb{width:100%;height:96px;object-fit:cover;border-radius:8px;background:#111;display:block;}#pubPreview .up-fail{opacity:.45;}#pubUploadStatus{margin:6px 0 10px;}`;
    document.head.appendChild(st);
  }
  function status(text) {
    let el = document.getElementById("pubUploadStatus");
    if (!el) {
      el = document.createElement("p");
      el.id = "pubUploadStatus";
      el.className = "muted";
      const box = document.getElementById("pubPreview");
      if (box) box.insertAdjacentElement("afterend", el);
    }
    if (el && text) el.textContent = text;
  }
  function toast(msg) {
    status(msg);
    const el = $("#toast");
    if (!el) return;
    el.textContent = msg;
    el.classList.remove("hidden");
    setTimeout(() => el.classList.add("hidden"), 3200);
  }
  function isVideoName(name, type) {
    return (type || "").startsWith("video") || /\.(mp4|mov|webm|mkv)$/i.test(name || "");
  }
  function previewBox() {
    const box = $("#pubPreview");
    if (!box) return;
    box.innerHTML = uploaded.map((m) => {
      const src = m.local || m.preview_url || (m.file_id ? "/api/media/file/" + encodeURIComponent(m.file_id) : "");
      const fail = m.failed ? " up-fail" : "";
      if (m.type === "video") return `<video class="up-thumb${fail}" src="${src}" muted playsinline preload="metadata"></video>`;
      return src ? `<img class="up-thumb${fail}" src="${src}" alt="" />` : `<div class="up-thumb"></div>`;
    }).join("");
  }
  function extraWrap() {
    let el = document.getElementById("pubExtras");
    if (el) return el;
    const form = document.getElementById("publishForm");
    if (!form) return null;
    el = document.createElement("div");
    el.id = "pubExtras";
    form.insertBefore(el, form.querySelector("button[type=submit]"));
    return el;
  }
  function toggleInput(id, on) {
    const el = document.getElementById(id);
    if (!el) return;
    const lab = el.previousElementSibling;
    el.style.display = on ? "" : "none";
    if (lab && lab.tagName === "LABEL") lab.style.display = on ? "" : "none";
  }
  function unwrap() {
    const form = document.getElementById("publishForm");
    const det = form && form.querySelector("details.advanced");
    if (!form || !det) return;
    ["pubPrice", "pubDistrict", "pubApprox", "pubTags"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (!(el.previousElementSibling && el.previousElementSibling.tagName === "LABEL")) {
        const lab = document.createElement("label");
        lab.textContent = { pubPrice: "价位", pubDistrict: "区域", pubApprox: "大致位置", pubTags: "标签" }[id];
        form.insertBefore(lab, det);
      } else form.insertBefore(el.previousElementSibling, det);
      form.insertBefore(el, det);
    });
    det.remove();
  }
  async function loadFields() {
    unwrap();
    const wrap = extraWrap();
    if (!wrap) return;
    let fields = [];
    try {
      const r = await fetch("/api/home?limit=1", { headers: { Authorization: "Bearer " + token() } });
      fields = ((await r.json()).listing_fields) || [];
    } catch (e) {}
    const enabled = (fields.length ? fields : Object.keys(FORM_MAP).map((k) => ({ key: k, form: true })))
      .filter((f) => f && f.key && f.form !== false && f.key !== "地点" && f.key !== "链接" && f.key !== "聊天按钮")
      .map((f) => String(f.key));
    Object.keys(FORM_MAP).forEach((key) => toggleInput(FORM_MAP[key], enabled.includes(key)));
    const extraKeys = enabled.filter((k) => !FORM_MAP[k]);
    wrap.innerHTML = extraKeys.map((k) => `<label>${k}</label><input data-extra="${k.replace(/"/g, "")}" maxlength="64" placeholder="${k}" />`).join("");
  }
  async function uploadOne(file) {
    const fd = new FormData();
    fd.append("files", file);
    const r = await fetch("/api/media/upload", { method: "POST", headers: { Authorization: "Bearer " + token() }, body: fd });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.detail || file.name + " 上传失败");
    return (data.items || [])[0];
  }
  $("#pubFiles")?.addEventListener("change", async (ev) => {
    const files = Array.from(ev.target.files || []).slice(0, 9);
    if (!files.length) return;
    uploaded = files.map((f) => ({ type: isVideoName(f.name, f.type) ? "video" : "image", local: URL.createObjectURL(f), file: f }));
    previewBox();
    const start = Date.now();
    let ok = 0;
    for (let i = 0; i < files.length; i += 1) {
      toast(`正在上传 ${i + 1}/${files.length}… ${Math.floor((Date.now() - start) / 1000)} 秒`);
      try {
        const it = await uploadOne(files[i]);
        uploaded[i] = { type: it.type || uploaded[i].type, url: it.file_id || it.url, file_id: it.file_id, thumb_file_id: it.thumb_file_id, preview_url: it.preview_url, local: uploaded[i].local };
        ok += 1;
        previewBox();
      } catch (e) { uploaded[i].failed = true; previewBox(); toast(e.message || String(e)); }
    }
    toast(`上传完成 ${ok}/${files.length}，用时 ${Math.floor((Date.now() - start) / 1000)} 秒`);
  });
  const form = $("#publishForm");
  if (!form) return;
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    ev.stopImmediatePropagation();
    const title = ($("#pubTitle")?.value || "").trim();
    if (!title) return toast("请填称呼");
    const media = uploaded.filter((m) => m.file_id || m.url).map((m) => ({ type: m.type, url: m.file_id || m.url, file_id: m.file_id, thumb_file_id: m.thumb_file_id, preview_url: m.preview_url }));
    const editId = ($("#editLampId")?.value || "").trim();
    if (!media.length && !editId) return toast("请先上传至少 1 个媒体");
    const extras = {};
    document.querySelectorAll("[data-extra]").forEach((inp) => {
      const k = (inp.getAttribute("data-extra") || "").trim();
      const v = (inp.value || "").trim();
      if (k && v) extras[k] = v;
    });
    const body = {
      city: $("#pubCity")?.value, title,
      price_text: ($("#pubPrice")?.value || "").trim(),
      district: ($("#pubDistrict")?.value || "").trim(),
      approx_label: ($("#pubApprox")?.value || "").trim(),
      tags: ($("#pubTags")?.value || "").trim().split(/\s+/).filter(Boolean).slice(0, 5),
      description: ($("#pubDesc")?.value || "").trim(), media, extras,
    };
    const digits = (body.price_text || "").replace(/\D/g, "");
    if (digits) body.price = parseInt(digits, 10);
    const url = editId ? `/api/me/listings/${editId}/edit` : "/api/posts";
    try {
      const r = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() }, body: JSON.stringify(body) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.detail || "提交失败");
      uploaded = [];
      if ($("#editLampId")) $("#editLampId").value = "";
      form.reset();
      previewBox();
      let admin = "管理员";
      try {
        const hd = window.__yycjHome || {};
        admin = (hd.contacts && hd.contacts.admin_label) || admin;
        window.__yycjAdminUrl = (hd.contacts && hd.contacts.admin_url) || window.__yycjAdminUrl || "";
      } catch (e) {}
      const done = document.createElement("div");
      done.className = "card";
      done.innerHTML = `<h3>已提交</h3><p>${editId ? "资料已更新。" : "资料已交给平台审核。"}</p><p class="muted">${editId ? "已上架的会直接改原帖。" : "请联系"+admin+"开通/续期上架。"}</p><button class="btn block" type="button" id="pubAgain">返回上架</button>`;
      form.classList.add("hidden");
      form.parentNode.insertBefore(done, form.nextSibling);
      $("#pubAgain")?.addEventListener("click", () => { done.remove(); form.classList.remove("hidden"); loadFields(); });
    } catch (e) { toast(e.message || String(e)); }
  }, true);
  document.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-nav='publish']")) setTimeout(loadFields, 80);
  });
  setTimeout(loadFields, 600);
})();
