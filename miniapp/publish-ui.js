(() => {
  const $ = (s) => document.querySelector(s);
  const token = () => localStorage.getItem("yycj_token") || "";
  let uploaded = [];
  let timer = null;

  function toast(msg) {
    const el = $("#toast");
    if (!el) return alert(msg);
    el.textContent = msg;
    el.classList.remove("hidden");
    setTimeout(() => el.classList.add("hidden"), 3200);
  }
  function previewBox() {
    const box = $("#pubPreview");
    if (!box) return;
    if (!uploaded.length) { box.innerHTML = ""; return; }
    box.innerHTML = `<div class="muted">已上传 ${uploaded.length} 个媒体</div>` +
      uploaded.map((m, i) => `<span class="up-chip">${m.type === "video" ? "视频" : "图"}${i + 1}</span>`).join(" ");
  }

  $("#pubFiles")?.addEventListener("change", async (ev) => {
    const files = Array.from(ev.target.files || []);
    if (!files.length) return;
    const fd = new FormData();
    files.slice(0, 9).forEach((f) => fd.append("files", f));
    const start = Date.now();
    const tick = () => {
      const sec = Math.floor((Date.now() - start) / 1000);
      toast(`正在上传 ${files.length} 个文件… ${sec} 秒`);
    };
    tick();
    timer = setInterval(tick, 1000);
    try {
      const r = await fetch("/api/media/upload", {
        method: "POST",
        headers: { Authorization: "Bearer " + token() },
        body: fd,
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.detail || "上传失败");
      uploaded = (data.items || []).map((it) => ({
        type: it.type || "image",
        url: it.file_id || it.url,
        file_id: it.file_id,
        preview_url: it.preview_url,
      }));
      previewBox();
      toast(`上传完成 ${uploaded.length} 个，用时 ${Math.floor((Date.now() - start) / 1000)} 秒`);
    } catch (e) {
      toast(e.message || String(e));
    } finally {
      if (timer) clearInterval(timer);
    }
  });

  const form = $("#publishForm");
  if (!form) return;
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    ev.stopImmediatePropagation();
    const title = ($("#pubTitle")?.value || "").trim();
    if (!title) return toast("请填称呼");
    if (!uploaded.length) return toast("请先上传至少 1 张图");
    const body = {
      city: $("#pubCity")?.value,
      title,
      price_text: ($("#pubPrice")?.value || "").trim(),
      district: ($("#pubDistrict")?.value || "").trim(),
      approx_label: ($("#pubApprox")?.value || "").trim(),
      tags: ($("#pubTags")?.value || "").trim().split(/\s+/).filter(Boolean).slice(0, 5),
      description: ($("#pubDesc")?.value || "").trim(),
      media: uploaded.map((m) => ({ type: m.type, url: m.file_id || m.url, file_id: m.file_id })),
    };
    const digits = (body.price_text || "").replace(/\D/g, "");
    if (digits) body.price = parseInt(digits, 10);
    const editId = ($("#editLampId")?.value || "").trim();
    const url = editId ? `/api/me/listings/${editId}/edit` : "/api/posts";
    try {
      const r = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.detail || "提交失败");
      uploaded = [];
      if ($("#editLampId")) $("#editLampId").value = "";
      if ($("#publishTitle")) $("#publishTitle").textContent = "上架";
      form.reset();
      previewBox();
      const done = document.createElement("div");
      done.className = "card";
      done.innerHTML = `<h3>${editId ? "改稿已交审" : "已提交审核"}</h3>
        <p class="muted">管理员通过后会出现在首页。</p>
        <button class="btn primary block" type="button" id="pubAgain">返回上架</button>`;
      form.classList.add("hidden");
      form.parentNode.insertBefore(done, form.nextSibling);
      $("#pubAgain")?.addEventListener("click", () => { done.remove(); form.classList.remove("hidden"); });
    } catch (e) {
      toast(e.message || String(e));
    }
  }, true);
})();
