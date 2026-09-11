(() => {
  if (window.__yycjAdminFields) return;
  window.__yycjAdminFields = true;
  const token = () => localStorage.getItem("yycj_token") || "";
  const DEFAULT_FIELDS = [
    { key: "称呼", label: "称呼", form: true },
    { key: "城市", label: "城市", form: true },
    { key: "简介", label: "简介", form: true },
    { key: "价位", label: "价位", form: true },
    { key: "区域", label: "区域", form: true },
    { key: "大致位置", label: "大致位置", form: true },
    { key: "标签", label: "标签", form: true },
    { key: "地点", label: "地点", form: false },
    { key: "链接", label: "链接", form: false },
  ];
  let fields = DEFAULT_FIELDS.map((x) => ({ ...x }));
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
    window.__listingFields = fields;
    const chips = fields.map((x) =>
      `<span class="ph-chip">${x.form ? "上架栏" : "仅模板"} {${x.key}} <button type="button" data-ph="${x.key}">插入</button> <button type="button" data-del-field="${x.key}">删除</button></span>`
    ).join("");
    el.innerHTML = `
      <p class="muted" style="margin:8px 0 4px">删除后上架页不再出现该栏；点插入会写入推送模板。</p>
      <div class="ph-list">${chips || "<p class='muted'>已全部删除</p>"}</div>
      <div class="row" style="margin-top:8px">
        <input id="newFieldLabel" placeholder="新增栏，如 微信 / 服务时间" style="flex:1;margin:0" />
        <button class="btn" type="button" id="btnAddField">添加栏</button>
      </div>`;
  }
  function insertPh(key) {
    const ta = document.getElementById("opsBroadcastTpl");
    if (!ta) return;
    const add = "{" + key + "}";
    const start = ta.selectionStart || ta.value.length;
    ta.value = ta.value.slice(0, start) + add + ta.value.slice(ta.selectionEnd || start);
    ta.dispatchEvent(new Event("input", { bubbles: true }));
    ta.focus();
  }
  document.addEventListener("click", (ev) => {
    const ph = ev.target.closest("[data-ph]");
    if (ph) { ev.preventDefault(); insertPh(ph.getAttribute("data-ph")); }
    const del = ev.target.closest("[data-del-field]");
    if (del) {
      ev.preventDefault();
      fields = fields.filter((x) => x.key !== del.getAttribute("data-del-field"));
      paint();
    }
    if (ev.target.id === "btnAddField") {
      const label = (document.getElementById("newFieldLabel")?.value || "").trim().slice(0, 16);
      if (!label) return;
      if (fields.some((x) => x.key === label)) return (window.yycjToast || alert)("栏已存在");
      fields.push({ key: label, label, form: true });
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
          listing_fields: fields,
        }),
      });
    } catch (e) {}
  }, true);
  setTimeout(async () => {
    try {
      const r = await fetch("/api/admin/homepage", { headers: { Authorization: "Bearer " + token() } });
      const s = (await r.json()).settings || {};
      const saved = Array.isArray(s.listing_fields) ? s.listing_fields.filter((x) => x && x.key) : [];
      fields = saved.length ? saved.map((x) => ({
        key: String(x.key),
        label: String(x.label || x.key),
        form: x.key === "地点" || x.key === "链接" ? false : x.form !== false,
      })) : DEFAULT_FIELDS.map((x) => ({ ...x }));
      if (document.getElementById("opsBroadcastTpl") && s.broadcast_template) {
        document.getElementById("opsBroadcastTpl").value = s.broadcast_template;
      }
    } catch (e) {}
    paint();
  }, 800);
})();
