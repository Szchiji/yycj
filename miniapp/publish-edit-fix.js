(() => {
  const form = document.getElementById("publishForm");
  if (!form) return;
  form.addEventListener("submit", (ev) => {
    const editId = (document.getElementById("editLampId")?.value || "").trim();
    if (!editId) return;
    const hasNew = [...(document.getElementById("pubFiles")?.files || [])].length > 0;
    if (hasNew) return;
    const toast = document.getElementById("toast");
    if (toast && /\u8bf7先上传/.test(toast.textContent || "")) {
      ev.stopImmediatePropagation();
    }
  }, true);
  const raw = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    const u = String(url || "");
    if (/\/api\/me\/listings\/.+\/edit/.test(u) && opts && opts.body) {
      try {
        const body = JSON.parse(opts.body);
        if (!(body.media && body.media.length)) {
          body.media = [];
          body.photos = [];
          opts = Object.assign({}, opts, { body: JSON.stringify(body) });
        }
      } catch (e) {}
    }
    return raw(url, opts);
  };
})();
