(() => {
  if (window.__yycjAdminFields) return;
  window.__yycjAdminFields = true;
  const token = () => localStorage.getItem("yycj_token") || "";
  const BUILTIN = [
    { key: "称呼", meaning: "上架填写的花名/称呼" },
    { key: "城市", meaning: "所在城市" },
    { key: "区域", meaning: "区，如南山" },
    { key: "地点", meaning: "城市 + 区域自动拼接" },
    { key: "价位", meaning: "价格或面议" },
    { key: "标签", meaning: "标签，自动加 #" },
    { key: "简介", meaning: "资料介绍" },
    { key: "大致位置", meaning: "附近/大概位置" },
    { key: "链接", meaning: "机器人小程序链接" },
  ];
  let custom = [];
  function box() {
    let el = document.getElementById("listingFieldBox");
    if (el) return el;
    const tpl = document.getElementById("opsBroadcastTpl");
    if (!tpl || !tpl.parentNode) return null;
    el = document.createElement("div");
    el.id = "listingFieldBox";
    tpl.parentNode.insertBefore(el, tpl.nextSibling);
    return el;
  }
  function paint() {
    const el = box();
    if (!el) return;
    const chips = BUILTIN.map((x) => `<button class="btn" type="button" data-ph="${x.key}">{${x.key}} ${x.meaning}</button>`).join("");
    const extras = custom.map((x) => `<span class="btn" style="margin:4px">${x.label} {${x.key}} <button type="button" data-del-field="${x.key}">删</button></span>`).join("");
    el.innerHTML = `
      <p class="muted" style="margin:8px 0 4px">点下面插入到模板（已是中文意思）</p>
      <div class="row" style="flex-wrap:wrap;gap:6px">${chips}</div>
      <label style="margin-top:10px">自定义上架栏（保存后老师上架页会出现，并成为占位符）</label>
      <div id="customFieldList">${extras || "<p class='muted'>还没有自定义栏</p>"}</div>
      <div class="row">
        <input id="newFieldLabel" placeholder="栏名称，如 微信 / 服务时间" style="flex:1;margin:0" />
        <button class="btn" type="button" id="btnAddField">添加栏</button>
      </div>`;
  }
  function insertPh(key) {
    const ta = document.getElementById("opsBroadcastTpl");
    if (!ta) return;
    const add = "{" + key + "}";
    const start = ta.selectionStart || ta.value.length;
    ta.value = ta.value.slice(0, start) + add + ta.value.slice(ta.selectionEnd || start);
    ta.focus();
  }
  document.addEventListener("click", (ev) => {
    const ph = ev.target.closest("[data-ph]");
    if (ph) { ev.preventDefault(); insertPh(ph.getAttribute("data-ph")); }
    const del = ev.target.closest("[data-del-field]");
    if (del) { custom = custom.filter((x) => x.key !== del.getAttribute("data-del-field")); paint(); }
    if (ev.target.id === "btnAddField") {
      const label = (document.getElementById("newFieldLabel")?.value || "").trim().slice(0, 16);
      if (!label) return;
      if (custom.some((x) => x.key === label) || BUILTIN.some((x) => x.key === label)) return alert("栏已存在");
      custom.push({ key: label, label, enabled: true });
      document.getElementById("newFieldLabel").value = "";
      paint();
    }
  });
  document.addEventListener("click", async (ev) => {
    if (!ev.target || ev.target.id !== "btnOpsSave") return;
    try {
      await fetch("/api/admin/settings/extra", {
        method: "POST",
        headers: { Authorization: "Bearer " + token(), "Content-Type": "application/json" },
        body: JSON.stringify({
          broadcast_channel: (document.getElementById("opsChannel")?.value || "").trim(),
          broadcast_template: document.getElementById("opsBroadcastTpl")?.value || "",
          media_channel_id: (document.getElementById("opsMediaChannel")?.value || "").trim(),
          listing_fields: custom,
        }),
      });
    } catch (e) {}
  }, true);
  setTimeout(async () => {
    try {
      const r = await fetch("/api/admin/homepage", { headers: { Authorization: "Bearer " + token() } });
      const s = (await r.json()).settings || {};
      custom = Array.isArray(s.listing_fields) ? s.listing_fields.filter((x) => x && x.key) : [];
      if (document.getElementById("opsBroadcastTpl") && s.broadcast_template) {
        document.getElementById("opsBroadcastTpl").value = s.broadcast_template;
      }
    } catch (e) {}
    paint();
  }, 800);
})();
