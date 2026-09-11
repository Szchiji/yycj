(() => {
  if (window.__yycjPubStatus) return;
  window.__yycjPubStatus = true;
  function bar() {
    let el = document.getElementById("pubUploadStatus");
    if (el) return el;
    el = document.createElement("p");
    el.id = "pubUploadStatus";
    el.className = "muted";
    el.style.margin = "6px 0 10px";
    const box = document.getElementById("pubPreview");
    if (box) box.insertAdjacentElement("afterend", el);
    return el;
  }
  function sync(text) {
    const el = bar();
    if (el && text) el.textContent = text;
  }
  const toast = document.getElementById("toast");
  if (toast) {
    new MutationObserver(() => sync(toast.textContent || "")).observe(toast, { childList: true, characterData: true, subtree: true });
  }
  document.getElementById("pubFiles")?.addEventListener("change", () => sync("正在上传…"), true);
})();
