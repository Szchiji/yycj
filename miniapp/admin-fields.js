(() => {
  if (window.__yycjAdminFields) return;
  window.__yycjAdminFields = true;
  const token = () => localStorage.getItem("yycj_token") || "";
  const DEFAULT_TEXT = "称呼\n城市\n简介\n价位\n区域\n大致位置\n标签\n地点 仅模板\n链接 仅模板";
  function parse(text) {
    const out = [];
    const seen = new Set();
    String(text || "").split("\n").forEach((line) => {
      const raw = line.trim();
      if (!raw) return;
      const only = /仅模板|\*$/.test(raw);
      const key = raw.replace(/仅模板|\*/g, "").trim().slice(0, 16);
      if (!key || seen.has(key)) return;
      seen.add(key);
      out.push({ key, label: key, form: !only && key !== "地点" && key !== "链接" && key !== "聊天按钮" });
    });
    return out;
  }
  function keysFromTpl() {
    const tpl = document.getElementById("opsBroadcastTpl")?.value || "";
    const found = [];
    const re = /\{([^}]{1,16})\}/g;
    let m;
    while ((m = re.exec(tpl))) found.push(m[1].trim());
    return found;
  }
  function toText(fields) {
    if (!fields || !fields.length) return DEFAULT_TEXT;
    return fields.map((x) => x.form === false ? (x.key + " 仅模板") : x.key).join("\n");
  }
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
  function sync() {
    const ta = document.getElementById("listingFieldsEditor");
    let list = parse(ta ? ta.value : DEFAULT_TEXT);
    const have = new Set(list.map((x) => x.key));
    keysFromTpl().forEach((key) => {
      if (!have.has(key)) {
        list.push({ key, label: key, form: key !== "地点" && key !== "链接" && key !== "聊天按钮" });
        have.add(key);
      }
    });
    window.__listingFields = list.length ? list : parse(DEFAULT_TEXT);
    if (ta) {
      const next = toText(window.__listingFields);
      if (ta.value.trim() !== next.trim()) ta.value = next;
    }
  }
  function paint(text) {
    const el = box();
    if (!el) return;
    el.innerHTML = `<label>上架栏（一行一个，末尾加「仅模板」则只用于推送）</label><textarea id="listingFieldsEditor" rows="9"></textarea><p class="muted" style="margin:6px 0 0">模板里写 {微信} 会自动出现在上架栏。改完点保存。</p><button class="btn" type="button" id="btnResetFields" style="margin-top:8px">恢复默认</button>`;
    const editor = document.getElementById("listingFieldsEditor");
    if (editor) editor.value = text || DEFAULT_TEXT;
    editor?.addEventListener("input", sync);
    document.getElementById("opsBroadcastTpl")?.addEventListener("input", sync);
    sync();
  }
  document.addEventListener("click", (ev) => {
    if (ev.target.id === "btnResetFields") paint(DEFAULT_TEXT);
    sync();
  }, true);
  setTimeout(async () => {
    let text = DEFAULT_TEXT;
    try {
      const r = await fetch("/api/admin/homepage", { headers: { Authorization: "Bearer " + token() } });
      const s = (await r.json()).settings || {};
      const saved = Array.isArray(s.listing_fields) ? s.listing_fields.filter((x) => x && x.key) : [];
      if (saved.length) text = toText(saved);
      const ta = document.getElementById("opsBroadcastTpl");
      if (ta && s.broadcast_template) ta.value = s.broadcast_template;
      const ch = document.getElementById("opsChannel");
      if (ch && s.broadcast_channel && !ch.value) ch.value = s.broadcast_channel;
    } catch (e) {}
    paint(text);
  }, 800);
})();
