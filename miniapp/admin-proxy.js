(() => {
  const pane = document.getElementById("pane-listings");
  if (!pane) return;
  if (!document.getElementById("proxyBox")) {
    const box = document.createElement("div");
    box.id = "proxyBox";
    box.className = "card";
    box.innerHTML = `<h3>代老师上架（免审）</h3>
      <p class="muted">资料挂在老师 ID 上，客人点联系会打给老师。</p>
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
  }
  if (!document.getElementById("editBox")) {
    const box = document.createElement("div");
    box.id = "editBox";
    box.className = "card";
    box.innerHTML = `<h3>代修改资料（免审）</h3>
      <p class="muted">从下方资料列表点「代修改」填入，保存后立刻覆盖，不走审核、不重复推频道。</p>
      <input id="editLampId" type="hidden" />
      <label>资料</label><input id="editLampLabel" readonly placeholder="先在列表点代修改" />
      <label>称呼</label><input id="editTitle" />
      <label>城市</label><input id="editCity" />
      <label>价位</label><input id="editPrice" />
      <label>简介</label><textarea id="editDesc" rows="3"></textarea>
      <label>相册（可选，选了就替换）</label>
      <input id="editFiles" type="file" accept="image/*,video/*" multiple />
      <div id="editPreview" class="media-preview"></div>
      <button class="btn primary" type="button" id="btnEditSave">保存修改</button>`;
    const proxy = document.getElementById("proxyBox");
    if (proxy && proxy.nextSibling) pane.insertBefore(box, proxy.nextSibling);
    else pane.appendChild(box);
  }
  const token = () => localStorage.getItem("yycj_token") || "";
  const uploadedP = [];
  const uploadedE = [];
  function preview(elId, list) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = list.map((m) => {
      const src = m.local || m.preview_url || (m.file_id ? "/api/media/file/" + encodeURIComponent(m.file_id) : "");
      return m.type === "video" ? `<video class="up-thumb" src="${src}" muted playsinline></video>` : `<img class="up-thumb" src="${src}" alt="" />`;
    }).join("");
  }
  async function uploadFiles(files, bucket, previewId) {
    for (const file of files) {
      const local = URL.createObjectURL(file);
      const fd = new FormData();
      fd.append("files", file);
      const r = await fetch("/api/media/upload", { method: "POST", headers: { Authorization: "Bearer " + token() }, body: fd });
      const data = await r.json();
      const item = (data.items && data.items[0]) || data;
      bucket.push({ type: file.type.startsWith("video") ? "video" : "image", file_id: item.file_id || "", preview_url: item.preview_url || "", url: item.url || item.file_id || "", local });
      preview(previewId, bucket);
    }
  }
  document.getElementById("proxyFiles")?.addEventListener("change", (ev) => { uploadFiles([...(ev.target.files || [])], uploadedP, "proxyPreview"); ev.target.value = ""; });
  document.getElementById("editFiles")?.addEventListener("change", (ev) => { uploadFiles([...(ev.target.files || [])], uploadedE, "editPreview"); ev.target.value = ""; });
  document.getElementById("btnProxy")?.addEventListener("click", async () => {
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
          media: uploadedP.map((m) => ({ type: m.type, file_id: m.file_id, url: m.url || m.file_id, preview_url: m.preview_url })),
          publisher_role: "teacher",
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "失败");
      alert("已代上架：" + ((data.lamp || {}).title || ""));
      uploadedP.length = 0; preview("proxyPreview", uploadedP);
      document.getElementById("btnRefresh")?.click();
    } catch (e) { alert(e.message || String(e)); }
  });
  document.getElementById("btnEditSave")?.addEventListener("click", async () => {
    const id = (document.getElementById("editLampId") || {}).value || "";
    if (!id) return alert("请先在资料列表点「代修改」");
    try {
      const r = await fetch("/api/admin/listings/" + encodeURIComponent(id) + "/proxy-edit", {
        method: "POST",
        headers: { Authorization: "Bearer " + token(), "Content-Type": "application/json" },
        body: JSON.stringify({
          title: document.getElementById("editTitle").value,
          city: document.getElementById("editCity").value,
          price_text: document.getElementById("editPrice").value,
          description: document.getElementById("editDesc").value,
          media: uploadedE.map((m) => ({ type: m.type, file_id: m.file_id, url: m.url || m.file_id, preview_url: m.preview_url })),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "失败");
      alert("已保存：" + ((data.lamp || {}).title || id));
      uploadedE.length = 0; preview("editPreview", uploadedE);
      document.getElementById("btnRefresh")?.click();
    } catch (e) { alert(e.message || String(e)); }
  });
  document.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-edit]");
    if (!btn) return;
    const id = btn.getAttribute("data-edit");
    const row = btn.closest(".pick-item");
    const title = row ? ((row.querySelector("strong") || {}).textContent || "") : "";
    const muted = row ? ((row.querySelector(".muted") || {}).textContent || "") : "";
    document.getElementById("editLampId").value = id;
    document.getElementById("editLampLabel").value = title + " · " + id.slice(0, 8);
    document.getElementById("editTitle").value = title;
    document.getElementById("editCity").value = (muted.split("·")[0] || "").trim();
    document.getElementById("editBox")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
})();
