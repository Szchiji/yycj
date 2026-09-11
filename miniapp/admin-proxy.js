(() => {
  const pane = document.getElementById("pane-listings");
  if (!pane || document.getElementById("proxyBox")) return;
  const box = document.createElement("div");
  box.id = "proxyBox";
  box.className = "card";
  box.innerHTML = `<h3>代老师上架</h3>
    <p class="muted">资料挂在老师 ID 上，客人点联系会打给老师。老师需先 /start 过机器人。</p>
    <label>老师用户 ID</label><input id="proxyUid" type="number" />
    <label>称呼</label><input id="proxyTitle" />
    <label>城市</label><input id="proxyCity" placeholder="深圳" />
    <label>价位</label><input id="proxyPrice" />
    <label>简介</label><textarea id="proxyDesc" rows="3"></textarea>
    <label>相册</label>
    <input id="proxyFiles" type="file" accept="image/*,video/*" multiple />
    <div id="proxyPreview" class="media-preview"></div>
    <button class="btn primary" type="button" id="btnProxy">直接上架</button>`;
  pane.prepend(box);
  const uploaded = [];
  function token() { return localStorage.getItem("yycj_token") || ""; }
  function preview() {
    const el = document.getElementById("proxyPreview");
    if (!el) return;
    el.innerHTML = uploaded.map((m) => {
      const src = m.local || m.preview_url || (m.file_id ? "/api/media/file/" + encodeURIComponent(m.file_id) : "");
      return m.type === "video"
        ? `<video class="up-thumb" src="${src}" muted playsinline></video>`
        : `<img class="up-thumb" src="${src}" alt="" />`;
    }).join("");
  }
  document.getElementById("proxyFiles")?.addEventListener("change", async (ev) => {
    const files = [...(ev.target.files || [])];
    ev.target.value = "";
    for (const file of files) {
      const local = URL.createObjectURL(file);
      const fd = new FormData();
      fd.append("files", file);
      try {
        const r = await fetch("/api/media/upload", {
          method: "POST",
          headers: { Authorization: "Bearer " + token() },
          body: fd,
        });
        const data = await r.json();
        const item = (data.items && data.items[0]) || data.media || data;
        uploaded.push({
          type: file.type.startsWith("video") ? "video" : "image",
          file_id: item.file_id || item.fileId || "",
          preview_url: item.preview_url || "",
          url: item.url || item.file_id || "",
          local,
        });
        preview();
      } catch (e) { alert(e.message || "上传失败"); }
    }
  });
  document.getElementById("btnProxy")?.addEventListener("click", async () => {
    const media = uploaded.map((m) => ({
      type: m.type,
      file_id: m.file_id,
      url: m.url || m.file_id,
      preview_url: m.preview_url,
    }));
    try {
      const r = await fetch("/api/admin/listings/proxy", {
        method: "POST",
        headers: { Authorization: "Bearer " + token(), "Content-Type": "application/json" },
        body: JSON.stringify({
          target_user_id: parseInt(document.getElementById("proxyUid").value, 10),
          title: document.getElementById("proxyTitle").value,
          city: document.getElementById("proxyCity").value,
          price_text: document.getElementById("proxyPrice").value,
          description: document.getElementById("proxyDesc").value,
          media,
          publisher_role: "teacher",
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "失败");
      alert("已代上架：" + ((data.lamp || {}).title || ""));
      uploaded.length = 0;
      preview();
      document.getElementById("btnRefresh")?.click();
    } catch (e) { alert(e.message || String(e)); }
  });
})();
