(() => {
  const pane = document.getElementById("pane-listings");
  if (!pane) return;
  const EXTRA_DEFAULT = ["联系", "频道", "微信"];
  function extraInputs(prefix) {
    return EXTRA_DEFAULT.map((k) => `<label>${k}</label><input data-extra="${k}" id="${prefix}_${k}" maxlength="64" />`).join("");
  }
  if (!document.getElementById("proxyBox")) {
    const box = document.createElement("div");
    box.id = "proxyBox";
    box.className = "card";
    box.innerHTML = `<h3>代老师上架（免审）</h3>
      <p class="muted">资料挂在老师 ID 上，客人点联系会打给老师。</p>
      <label>老师用户 ID</label><input id="proxyUid" type="number" />
      <label>称呼</label><input id="proxyTitle" />
      <label>城市</label><input id="proxyCity" value="深圳" />
      <label>价位</label><input id="proxyPrice" />
      <label>简介</label><textarea id="proxyDesc" rows="3"></textarea>
      <label>区域</label><input id="proxyDistrict" />
      <label>大致位置</label><input id="proxyApprox" />
      <label>标签</label><input id="proxyTags" placeholder="空格分隔" />
      <div id="proxyExtras">${extraInputs("proxy")}</div>
      <label>相册</label>
      <input id="proxyFiles" type="file" accept="image/*,video/*" multiple />
      <div id="proxyStatus" class="muted"></div>
      <div id="proxyPreview" class="media-preview"></div>
      <button class="btn primary" type="button" id="btnProxy">直接上架</button>`;
    pane.prepend(box);
  }
  if (!document.getElementById("editBox")) {
    const box = document.createElement("div");
    box.id = "editBox";
    box.className = "card";
    box.innerHTML = `<h3>代修改资料（免审）</h3>
      <p class="muted">从下方资料列表点「代改」填入，保存后立刻覆盖，不走审核、不重复推频道。</p>
      <input id="editLampId" type="hidden" />
      <label>资料</label><input id="editLampLabel" readonly placeholder="先在列表点代改" />
      <label>称呼</label><input id="editTitle" />
      <label>城市</label><input id="editCity" />
      <label>价位</label><input id="editPrice" />
      <label>简介</label><textarea id="editDesc" rows="3"></textarea>
      <label>区域</label><input id="editDistrict" />
      <label>大致位置</label><input id="editApprox" />
      <label>标签</label><input id="editTags" placeholder="空格分隔" />
      <div id="editExtras">${extraInputs("edit")}</div>
      <label>相册（可选，选了就替换）</label>
      <input id="editFiles" type="file" accept="image/*,video/*" multiple />
      <div id="editStatus" class="muted"></div>
      <div id="editPreview" class="media-preview"></div>
      <button class="btn primary" type="button" id="btnEditSave">保存修改</button>`;
    const proxy = document.getElementById("proxyBox");
    if (proxy && proxy.nextSibling) pane.insertBefore(box, proxy.nextSibling);
    else pane.appendChild(box);
  }
  const token = () => localStorage.getItem("yycj_token") || "";
  const uploadedP = [];
  const uploadedE = [];
  function collectExtras(boxId) {
    const out = {};
    document.querySelectorAll("#" + boxId + " [data-extra]").forEach((el) => {
      const k = (el.getAttribute("data-extra") || "").trim();
      const v = (el.value || "").trim();
      if (k && v) out[k] = v;
    });
    return out;
  }
  async function syncExtras() {
    let fields = [];
    try {
      const r = await fetch("/api/home?limit=1", { headers: { Authorization: "Bearer " + token() } });
      fields = ((await r.json()).listing_fields) || [];
    } catch (e) {}
    const keys = fields.filter((f) => f && f.key && f.form !== false)
      .map((f) => String(f.key))
      .filter((k) => !["称呼","城市","价位","简介","区域","大致位置","标签","地点","链接","聊天按钮"].includes(k));
    ["proxyExtras", "editExtras"].forEach((id) => {
      const wrap = document.getElementById(id);
      if (!wrap) return;
      const have = new Set([...wrap.querySelectorAll("[data-extra]")].map((el) => el.getAttribute("data-extra")));
      keys.forEach((k) => {
        if (have.has(k)) return;
        wrap.insertAdjacentHTML("beforeend", `<label>${k}</label><input data-extra="${k}" maxlength="64" />`);
      });
    });
  }
  function preview(elId, list) {
    const el = document.getElementById(elId);
    if (!el) return;
    el.innerHTML = list.map((m) => {
      if (m.pending) return `<div class="up-thumb" style="height:88px;display:flex;align-items:center;justify-content:center;background:#111;border-radius:8px">上传中</div>`;
      const src = m.local || m.preview_url || "";
      return m.type === "video"
        ? `<video class="up-thumb" src="${src}" muted playsinline preload="metadata" style="width:100%;height:88px;object-fit:cover;border-radius:8px;background:#111"></video>`
        : `<img class="up-thumb" src="${src}" style="width:100%;height:88px;object-fit:cover;border-radius:8px" alt="" />`;
    }).join("");
  }
  async function uploadFiles(files, bucket, previewId, statusId) {
    const status = document.getElementById(statusId);
    const arr = [...files];
    for (let i = 0; i < arr.length; i++) {
      const file = arr[i];
      const local = URL.createObjectURL(file);
      const item = { type: file.type.startsWith("video") ? "video" : "image", local, pending: true };
      bucket.push(item);
      if (status) status.textContent = "正在上传 " + (i + 1) + "/" + arr.length;
      preview(previewId, bucket);
      try {
        const fd = new FormData();
        fd.append("files", file);
        const r = await fetch("/api/media/upload", { method: "POST", headers: { Authorization: "Bearer " + token() }, body: fd });
        const data = await r.json().catch(() => ({}));
        const one = (data.items && data.items[0]) || data;
        item.pending = false;
        item.file_id = one.file_id || "";
        item.preview_url = one.preview_url || one.thumb_url || local;
        item.url = one.url || item.file_id;
      } catch (e) {
        item.pending = false;
        item.failed = true;
        if (status) status.textContent = "上传失败";
      }
      preview(previewId, bucket);
    }
    if (status) status.textContent = "上传完成";
  }
  function mediaOf(bucket) {
    return bucket.filter((m) => !m.failed && !m.pending).map((m) => ({
      type: m.type, file_id: m.file_id, url: m.url || m.file_id, preview_url: m.preview_url || ""
    }));
  }
  document.getElementById("proxyFiles")?.addEventListener("change", (ev) => {
    uploadFiles([...(ev.target.files || [])], uploadedP, "proxyPreview", "proxyStatus");
    ev.target.value = "";
  });
  document.getElementById("editFiles")?.addEventListener("change", (ev) => {
    uploadFiles([...(ev.target.files || [])], uploadedE, "editPreview", "editStatus");
    ev.target.value = "";
  });
  document.getElementById("btnProxy")?.addEventListener("click", async () => {
    const uid = parseInt(document.getElementById("proxyUid").value, 10);
    if (!uid) return alert("请填老师用户 ID");
    const extras = collectExtras("proxyBox");
    try {
      const r = await fetch("/api/admin/listings/proxy", {
        method: "POST",
        headers: { Authorization: "Bearer " + token(), "Content-Type": "application/json" },
        body: JSON.stringify({
          target_user_id: uid,
          title: document.getElementById("proxyTitle").value,
          city: document.getElementById("proxyCity").value,
          price_text: document.getElementById("proxyPrice").value,
          description: document.getElementById("proxyDesc").value,
          district: document.getElementById("proxyDistrict").value,
          approx_label: document.getElementById("proxyApprox").value,
          tags: (document.getElementById("proxyTags").value || "").split(/[,，\s]+/).filter(Boolean),
          extras,
          media: mediaOf(uploadedP),
          publisher_role: "teacher",
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "失败");
      alert("已代上架并按模板推送：" + ((data.lamp || {}).title || ""));
      uploadedP.length = 0; preview("proxyPreview", uploadedP);
      document.getElementById("btnRefresh")?.click();
    } catch (e) { alert(e.message || String(e)); }
  });
  document.getElementById("btnEditSave")?.addEventListener("click", async () => {
    const id = document.getElementById("editLampId").value || "";
    if (!id) return alert("请先在资料列表点「代改」");
    const extras = collectExtras("editBox");
    try {
      const r = await fetch("/api/admin/listings/" + encodeURIComponent(id) + "/proxy-edit", {
        method: "POST",
        headers: { Authorization: "Bearer " + token(), "Content-Type": "application/json" },
        body: JSON.stringify({
          title: document.getElementById("editTitle").value,
          city: document.getElementById("editCity").value,
          price_text: document.getElementById("editPrice").value,
          description: document.getElementById("editDesc").value,
          district: document.getElementById("editDistrict").value,
          approx_label: document.getElementById("editApprox").value,
          tags: (document.getElementById("editTags").value || "").split(/[,，\s]+/).filter(Boolean),
          extras,
          media: mediaOf(uploadedE),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "失败");
      alert("已保存修改");
      uploadedE.length = 0; preview("editPreview", uploadedE);
      document.getElementById("btnRefresh")?.click();
    } catch (e) { alert(e.message || String(e)); }
  });
  window.yycjFillProxy = function (item) {
    if (!item) return;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ""; };
    const extras = item.extras || {};
    set("editLampId", item.lamp_id);
    set("editLampLabel", (item.title || "") + " · " + (item.city || ""));
    set("editTitle", item.title);
    set("editCity", item.city);
    set("editPrice", item.price_text);
    set("editDesc", item.description);
    set("editDistrict", item.district || extras["区域"]);
    set("editApprox", item.approx_label || extras["大致位置"]);
    set("editTags", (item.tags || []).join(" "));
    document.querySelectorAll("#editBox [data-extra]").forEach((el) => {
      el.value = extras[el.getAttribute("data-extra")] || "";
    });
    document.getElementById("editBox")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };
  syncExtras();
  setTimeout(syncExtras, 1200);
})();
