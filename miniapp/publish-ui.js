(() => {
  const $ = (s) => document.querySelector(s);
  const token = () => localStorage.getItem("yycj_token") || "";
  let uploaded = [];
  if (!document.getElementById("yycj-pub-css")) {
    const st = document.createElement("style");
    st.id = "yycj-pub-css";
    st.textContent = `#pubPreview{display:grid!important;grid-template-columns:repeat(3,1fr)!important;gap:6px;margin:8px 0;}#pubPreview .up-thumb{width:100%;height:96px;object-fit:cover;border-radius:8px;background:#111;display:block;}#pubPreview .up-fail{opacity:.45;}`;
    document.head.appendChild(st);
  }
  function toast(msg) {
    const el = $("#toast");
    if (!el) return alert(msg);
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
        uploaded[i] = { type: it.type || uploaded[i].type, url: it.file_id || it.url, file_id: it.file_id, preview_url: it.preview_url, local: uploaded[i].local };
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
    const media = uploaded.filter((m) => m.file_id || m.url).map((m) => ({ type: m.type, url: m.file_id || m.url, file_id: m.file_id }));
    if (!media.length) return toast("请先上传至少 1 个媒体");
    const body = {
      city: $("#pubCity")?.value, title,
      price_text: ($("#pubPrice")?.value || "").trim(),
      district: ($("#pubDistrict")?.value || "").trim(),
      approx_label: ($("#pubApprox")?.value || "").trim(),
      tags: ($("#pubTags")?.value || "").trim().split(/\s+/).filter(Boolean).slice(0, 5),
      description: ($("#pubDesc")?.value || "").trim(), media,
    };
    const digits = (body.price_text || "").replace(/\D/g, "");
    if (digits) body.price = parseInt(digits, 10);
    const editId = ($("#editLampId")?.value || "").trim();
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
        const hr = await fetch("/api/home?limit=1", { headers: { Authorization: "Bearer " + token() } });
        const hd = await hr.json();
        admin = (hd.contacts && hd.contacts.admin_label) || admin;
        window.__yycjAdminUrl = (hd.contacts && hd.contacts.admin_url) || "";
      } catch (e) {}
      const done = document.createElement("div");
      done.className = "card";
      done.innerHTML = `<h3>已提交审核</h3><p>资料已交给平台审核。</p><p class="muted">请联系${admin}开通/续期上架。通过后首页才会展示。</p><p class="muted">本次上传 ${media.length} 个媒体。</p><button class="btn primary block" type="button" id="pubContactAdmin">联系管理员</button><button class="btn block" type="button" id="pubAgain">继续上架</button>`;
      form.classList.add("hidden");
      form.parentNode.insertBefore(done, form.nextSibling);
      $("#pubAgain")?.addEventListener("click", () => { done.remove(); form.classList.remove("hidden"); });
      $("#pubContactAdmin")?.addEventListener("click", () => {
        const href = window.__yycjAdminUrl || "";
        const tg = window.Telegram && window.Telegram.WebApp;
        if (href && tg && tg.openTelegramLink) tg.openTelegramLink(href);
        else if (href) location.href = href;
        else toast("后台还没填管理员联系方式");
      });
    } catch (e) { toast(e.message || String(e)); }
  }, true);
})();
