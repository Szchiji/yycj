(() => {
  const pane = document.getElementById("pane-listings");
  if (!pane) return;
  if (document.getElementById("proxyBox")) document.getElementById("proxyBox").remove();
  const box = document.createElement("div");
  box.id = "proxyBox";
  box.className = "card admin-form";
  box.innerHTML = `<h3 id="proxyHeading">代上架 / 代修改</h3>
    <p class="muted">新上架填老师 ID；代修改点列表里的「代改」。媒体可直接上传。</p>
    <input type="hidden" id="proxyLampId" />
    <label>老师用户 ID</label><input id="proxyUid" type="number" />
    <label>称呼</label><input id="proxyTitle" />
    <label>城市</label><input id="proxyCity" placeholder="深圳" />
    <label>价位</label><input id="proxyPrice" />
    <label>区 / 标签</label>
    <div class="row"><input id="proxyDistrict" placeholder="区" /><input id="proxyTags" placeholder="标签空格分隔" /></div>
    <label>简介</label><textarea id="proxyDesc" rows="3"></textarea>
    <label>相册</label>
    <input id="proxyFiles" type="file" accept="image/*,video/*" multiple />
    <div id="proxyPreview" class="media-preview"></div>
    <div class="row">
      <button class="btn primary" type="button" id="btnProxy">保存</button>
      <button class="btn" type="button" id="btnProxyReset">清空为新上架</button>
    </div>`;
  pane.prepend(box);
  const uploaded = [];
  function token() { return localStorage.getItem("yycj_token") || ""; }
  function val(id) { return (document.getElementById(id) || {}).value || ""; }
  function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v == null ? "" : v; }
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
  function resetForm() {
    setVal("proxyLampId", "");
    ["proxyUid","proxyTitle","proxyCity","proxyPrice","proxyDistrict","proxyTags","proxyDesc"].forEach((id) => setVal(id, ""));
    uploaded.length = 0;
    preview();
    const h = document.getElementById("proxyHeading");
    if (h) h.textContent = "代上架 / 代修改";
  }
  window.yycjFillProxy = function (item) {
    setVal("proxyLampId", item.lamp_id || "");
    setVal("proxyUid", item.user_id || "");
    setVal("proxyTitle", item.title || "");
    setVal("proxyCity", item.city || "");
    setVal("proxyPrice", item.price_text || "");
    setVal("proxyDistrict", item.district || "");
    setVal("proxyTags", (item.tags || []).join(" "));
    setVal("proxyDesc", item.description || "");
    uploaded.length = 0;
    (item.media || []).forEach((m) => uploaded.push({
      type: m.type || "image",
      file_id: m.file_id || m.url || "",
      url: m.url || m.file_id || "",
      preview_url: m.preview_url || "",
    }));
    preview();
    const h = document.getElementById("proxyHeading");
    if (h) h.textContent = "代修改：" + (item.title || item.lamp_id);
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  };
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
        const item = (data.items && data.items[0]) || {};
        uploaded.push({
          type: file.type.startsWith("video") ? "video" : "image",
          file_id: item.file_id || "",
          preview_url: item.preview_url || "",
          url: item.url || item.file_id || "",
          local,
        });
        preview();
      } catch (e) { alert(e.message || "上传失败"); }
    }
  });
  document.getElementById("btnProxyReset")?.addEventListener("click", resetForm);
  document.getElementById("btnProxy")?.addEventListener("click", async () => {
    const media = uploaded.map((m) => ({
      type: m.type,
      file_id: m.file_id,
      url: m.url || m.file_id,
      preview_url: m.preview_url,
    }));
    const lampId = val("proxyLampId");
    const payload = {
      target_user_id: parseInt(val("proxyUid"), 10),
      title: val("proxyTitle"),
      city: val("proxyCity"),
      price_text: val("proxyPrice"),
      district: val("proxyDistrict"),
      tags: val("proxyTags").split(/\s+/).filter(Boolean),
      description: val("proxyDesc"),
      media,
      publisher_role: "teacher",
    };
    try {
      const path = lampId
        ? "/api/admin/listings/" + encodeURIComponent(lampId) + "/proxy-edit"
        : "/api/admin/listings/proxy";
      const r = await fetch(path, {
        method: "POST",
        headers: { Authorization: "Bearer " + token(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "失败");
      alert(lampId ? "已代修改" : ("已代上架：" + ((data.lamp || {}).title || "")));
      resetForm();
      document.getElementById("btnRefresh")?.click();
    } catch (e) { alert(e.message || String(e)); }
  });
  document.getElementById("adminListings")?.addEventListener("click", (ev) => {
    const btn = ev.target.closest("[data-proxy-edit]");
    if (!btn) return;
    try {
      const item = JSON.parse(btn.getAttribute("data-proxy-edit") || "{}");
      window.yycjFillProxy(item);
    } catch (e) {}
  });
})();
