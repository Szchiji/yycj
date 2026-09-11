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
  window.__listingFields = fields;
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
    if (!fields.length) fields = DEFAULT_FIELDS.map((x) => ({ ...x }));
    window.__listingFields = fields;
    const rows = fields.map((x) =>
      `<div class="ph-row"><span class="ph-name">{${x.key}}</span><span class="muted">${x.form ? "上架页显示" : "只用于推送"}</span><button class="btn" type="button" data-ph="${x.key}">插入</button><button class="btn" type="button" data-del-field="${x.key}">删除</button></div>`
    ).join("");
    el.innerHTML = `<p class="muted" style="margin:8px 0 6px">插入写入上面的推送模板。删除后上架页不再出现该栏。</p><div class="ph-list">${rows}</div><div class="row" style="margin-top:8px"><input id="newFieldLabel" placeholder="新增栏，如 微信 / 服务时间" style="flex:1;margin:0" /><button class="btn" type="button" id="btnAddField">添加栏</button></div><button class="btn" type="button" id="btnResetFields" style="margin-top:8px">恢复默认占位符</button> <button class="btn" type="button" id="btnZhTpl" style="margin-top:8px">换成中文模板</button>`;
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
    if (ev.target.id === "btnResetFields") {
      fields = DEFAULT_FIELDS.map((x) => ({ ...x }));
      paint();
    }
    if (ev.target.id === "btnZhTpl") {
      const ta = document.getElementById("opsBroadcastTpl");
      if (ta) {
        ta.value = "🌙 月影车姬 · 新上架\n{称呼}\n📍 {地点}\n💰 {价位}\n{标签}\n{简介}\n{链接}";
        ta.dispatchEvent(new Event("input", { bubbles: true }));
      }
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
      const ta = document.getElementById("opsBroadcastTpl");
      if (ta && s.broadcast_template) ta.value = s.broadcast_template;
      const ch = document.getElementById("opsChannel");
      if (ch && s.broadcast_channel && !ch.value) ch.value = s.broadcast_channel;
    } catch (e) {}
    paint();
  }, 800);
})();
