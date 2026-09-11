(() => {
  const $ = (s) => document.querySelector(s);
  const token = () => localStorage.getItem("yycj_token") || "";
  let uploaded = [];

  function toast(msg) {
    const el = $("#toast");
    if (!el) return alert(msg);
    el.textContent = msg;
    el.classList.remove("hidden");
    setTimeout(() => el.classList.add("hidden"), 2800);
  }
  function previewBox() {
    const box = $("#pubPreview");
    if (!box) return;
    box.innerHTML = uploaded.map((m) => {
      const src = m.preview_url || m.url;
      if (m.type === "video") return `<video src="${src}" muted></video>`;
      return `<img src="${src}" alt="" />`;
    }).join("");
  }

  $("#pubFiles")?.addEventListener("change", async (ev) => {
    const files = Array.from(ev.target.files || []);
    if (!files.length) return;
    const fd = new FormData();
    files.slice(0, 9).forEach((f) => fd.append("files", f));
    try {
      toast("正在上传媒体…");
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
      const ta = $("#pubMedia");
      if (ta) ta.value = uploaded.map((m) => (m.type === "video" ? "video|" : "") + (m.url || "")).join("\n");
      previewBox();
      toast("媒体已上传 " + uploaded.length + " 个");
    } catch (e) {
      toast(e.message || String(e));
    }
  });

  const form = $("#publishForm");
  if (!form) return;
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    ev.stopImmediatePropagation();
    const title = ($("#pubTitle")?.value || "").trim();
    if (!title) return toast("请填称呼");
    const body = {
      city: $("#pubCity")?.value,
      title,
      price_text: ($("#pubPrice")?.value || "").trim(),
      district: ($("#pubDistrict")?.value || "").trim(),
      approx_label: ($("#pubApprox")?.value || "").trim(),
      tags: ($("#pubTags")?.value || "").trim().split(/\s+/).filter(Boolean).slice(0, 5),
      description: ($("#pubDesc")?.value || "").trim(),
      media: uploaded.map((m) => ({ type: m.type, url: m.url, file_id: m.file_id })),
    };
    const digits = (body.price_text || "").replace(/\D/g, "");
    if (digits) body.price = parseInt(digits, 10);
    try {
      const r = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.detail || "提交失败");
      uploaded = [];
      form.reset();
      previewBox();
      const done = document.createElement("div");
      done.className = "card";
      done.id = "pubDone";
      done.innerHTML = `<h3>已提交审核</h3>
        <p>编号 <code>${(data.post_id || "").slice(0,8)}</code></p>
        <p class="muted">管理员通过后会出现在首页，机器人也会发你通知。请勿重复提交。</p>
        <button class="btn primary block" type="button" id="pubAgain">再上架一条</button>`;
      form.classList.add("hidden");
      form.parentNode.insertBefore(done, form.nextSibling);
      $("#pubAgain")?.addEventListener("click", () => {
        done.remove();
        form.classList.remove("hidden");
      });
    } catch (e) {
      toast(e.message || String(e));
    }
  }, true);
})();
