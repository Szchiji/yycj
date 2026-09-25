(() => {
  if (window.__yycjPreview) return;
  window.__yycjPreview = true;
  const token = () => localStorage.getItem("yycj_token") || "";
  function mount() {
    const ta = document.getElementById("opsBroadcastTpl");
    if (!ta || document.getElementById("tplPreviewBox")) return;
    const box = document.createElement("div");
    box.id = "tplPreviewBox";
    box.innerHTML = '<div class="row" style="margin:8px 0"><button class="btn" type="button" id="btnTplPreview">预览推送文案</button></div><pre id="tplPreview" class="muted" style="white-space:pre-wrap;background:rgba(0,0,0,.25);padding:10px;border-radius:10px;min-height:48px">点预览看频道成品（用最新一条真实资料）</pre>';
    ta.parentNode.insertBefore(box, ta.nextSibling);
  }
  async function preview() {
    const out = document.getElementById("tplPreview");
    if (out) out.textContent = "生成中…";
    try {
      const r = await fetch("/api/admin/broadcast/preview", {
        method: "POST",
        headers: { Authorization: "Bearer " + token(), "Content-Type": "application/json" },
        body: JSON.stringify({ template: document.getElementById("opsBroadcastTpl")?.value || "" }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "预览失败");
      const head = data.title ? ("「" + data.title + "」\n") : "";
      if (out) out.textContent = head + (data.text || "(空)");
    } catch (e) {
      if (out) out.textContent = e.message || String(e);
    }
  }
  document.addEventListener("click", (ev) => {
    if (ev.target && ev.target.id === "btnTplPreview") preview();
  });
  setTimeout(mount, 800);
  setTimeout(mount, 2000);
})();
