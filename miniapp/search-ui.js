(() => {
  const input = document.getElementById("homeQ");
  const hint = document.getElementById("searchHint");
  const clearBtn = document.getElementById("btnSearchClear");
  let timer = 0;
  function run() {
    const btn = document.getElementById("btnSearch");
    if (btn) btn.click();
    if (hint) {
      const q = (input && input.value.trim()) || "";
      hint.textContent = q ? ("搜索：" + q + " · 花名/标签/城区/价位，不限当前城市") : "";
    }
  }
  input?.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(run, 350);
  });
  input?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") {
      ev.preventDefault();
      clearTimeout(timer);
      run();
    }
  });
  clearBtn?.addEventListener("click", () => {
    if (input) input.value = "";
    run();
  });
})();
