(() => {
  if (window.__yycjProxyPlus) return;
  window.__yycjProxyPlus = true;
  const token = () => localStorage.getItem("yycj_token") || "";
  const CORE = new Set(["称呼", "城市", "价位", "简介", "区域", "大致位置", "标签"]);
  function inject(afterId, wrapId) {
    const after = document.getElementById(afterId);
    if (!after || document.getElementById(wrapId)) return;
    const wrap = document.createElement("div");
    wrap.id = wrapId;
    after.insertAdjacentElement("afterend", wrap);
    return wrap;
  }
  function addCore(afterId, id, label) {
    if (document.getElementById(id)) return;
    const after = document.getElementById(afterId);
    if (!after) return;
    const lab = document.createElement("label");
    lab.textContent = label;
    const inp = document.createElement("input");
    inp.id = id;
    after.insertAdjacentElement("afterend", inp);
    inp.insertAdjacentElement("beforebegin", lab);
  }
  async function fields() {
    let list = [];
    try {
      const r = await fetch("/api/home?limit=1", { headers: { Authorization: "Bearer " + token() } });
      list = (await r.json()).listing_fields || [];
    } catch (e) {}
    const keys = (list.length ? list : [...CORE].map((k) => ({ key: k })))
      .filter((f) => f && f.key && f.form !== false)
      .map((f) => String(f.key))
      .filter((k) => !["地点", "链接", "聊天按钮"].includes(k) && !CORE.has(k));
    ["proxyExtras", "editExtras"].forEach((id, i) => {
      const wrap = inject(i ? "editDesc" : "proxyDesc", id) || document.getElementById(id);
      if (!wrap) return;
      wrap.innerHTML = keys.map((k) => `<label>${k}</label><input data-extra="${k}" maxlength="64" placeholder="${k}" />`).join("");
    });
    addCore("proxyDesc", "proxyDistrict", "区域");
    addCore("proxyDistrict", "proxyApprox", "大致位置");
    addCore("editDesc", "editDistrict", "区域");
    addCore("editDistrict", "editApprox", "大致位置");
  }
  function extras(boxId) {
    const out = {};
    document.querySelectorAll("#" + boxId + " [data-extra]").forEach((el) => {
      const k = el.getAttribute("data-extra");
      const v = (el.value || "").trim();
      if (k && v) out[k] = v;
    });
    return out;
  }
  function note(id, text) {
    let el = document.getElementById(id);
    if (!el) {
      const files = document.getElementById(id.replace("Status", "Files"));
      el = document.createElement("div");
      el.id = id;
      el.className = "muted";
      files?.insertAdjacentElement("afterend", el);
    }
    el.textContent = text || "";
  }
  function preview(id, list) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = list.map((m) => {
      if (m.pending) return `<div class="up-thumb" style="display:flex;align-items:center;justify-content:center;height:88px;background:#111;border-radius:8px">上传中</div>`;
      const src = m.local || m.preview_url || "";
      return m.type === "video"
        ? `<video class="up-thumb" src="${src}" muted playsinline preload="metadata" style="width:100%;height:88px;object-fit:cover;border-radius:8px;background:#111"></video>`
        : `<img class="up-thumb" src="${src}" alt="" style="width:100%;height:88px;object-fit:cover;border-radius:8px" />`;
    }).join("");
  }
  const bucket = { proxy: [], edit: [] };
  async function upload(which, files) {
    const list = bucket[which];
    const previewId = which === "proxy" ? "proxyPreview" : "editPreview";
    const statusId = which === "proxy" ? "proxyStatus" : "editStatus";
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const local = URL.createObjectURL(file);
      const item = { type: file.type.startsWith("video") ? "video" : "image", local, pending: true };
      list.push(item);
      note(statusId, "正在上传 " + (i + 1) + "/" + files.length);
      preview(previewId, list);
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
        note(statusId, "上传失败");
      }
      preview(previewId, list);
    }
    note(statusId, "上传完成");
  }
  function rebind(id, which) {
    const old = document.getElementById(id);
    if (!old) return;
    const neu = old.cloneNode(true);
    old.parentNode.replaceChild(neu, old);
    neu.addEventListener("change", (ev) => {
      upload(which, [...(ev.target.files || [])]);
      ev.target.value = "";
    });
  }
  rebind("proxyFiles", "proxy");
  rebind("editFiles", "edit");
  const orig = window.fetch;
  window.fetch = function (url, opt) {
    try {
      const u = String(url || "");
      if (opt && typeof opt.body === "string") {
        if (u.includes("/api/admin/listings/proxy") && !u.includes("proxy-edit")) {
          const body = JSON.parse(opt.body);
          body.extras = Object.assign({}, extras("proxyBox"), extras("proxyExtras"), body.extras || {});
          body.district = (document.getElementById("proxyDistrict") || {}).value || body.district;
          body.approx_label = (document.getElementById("proxyApprox") || {}).value || body.approx_label;
          if (bucket.proxy.length) {
            body.media = bucket.proxy.filter((m) => !m.failed).map((m) => ({
              type: m.type, file_id: m.file_id, url: m.url || m.file_id, preview_url: m.preview_url,
            }));
          }
          opt = Object.assign({}, opt, { body: JSON.stringify(body) });
        }
        if (u.includes("/proxy-edit")) {
          const body = JSON.parse(opt.body);
          body.extras = Object.assign({}, extras("editBox"), extras("editExtras"), body.extras || {});
          body.district = (document.getElementById("editDistrict") || {}).value || body.district;
          body.approx_label = (document.getElementById("editApprox") || {}).value || body.approx_label;
          if (bucket.edit.length) {
            body.media = bucket.edit.filter((m) => !m.failed).map((m) => ({
              type: m.type, file_id: m.file_id, url: m.url || m.file_id, preview_url: m.preview_url,
            }));
          }
          opt = Object.assign({}, opt, { body: JSON.stringify(body) });
        }
      }
    } catch (e) {}
    return orig.apply(this, arguments.length > 1 ? [url, opt] : [url]);
  };
  const fill = window.yycjFillProxy;
  window.yycjFillProxy = function (item) {
    if (typeof fill === "function") fill(item);
    if (!item) return;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ""; };
    set("editTitle", item.title);
    set("editCity", item.city);
    set("editPrice", item.price_text);
    set("editDesc", item.description);
    set("editDistrict", item.district || (item.extras || {})["区域"]);
    set("editApprox", item.approx_label || (item.extras || {})["大致位置"]);
    document.querySelectorAll("#editExtras [data-extra]").forEach((el) => {
      el.value = ((item.extras || {})[el.getAttribute("data-extra")]) || "";
    });
  };
  fields();
  setTimeout(fields, 1500);
})();
