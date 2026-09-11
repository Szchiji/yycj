(() => {
  const row = document.querySelector(".search-row");
  const pins = document.getElementById("pins");
  const announce = document.getElementById("announce");
  if (row && pins && row.compareDocumentPosition(pins) & Node.DOCUMENT_POSITION_PRECEDING) {
    pins.parentElement.insertBefore(row, pins);
  } else if (row && announce && announce.nextElementSibling !== row) {
    announce.parentElement.insertBefore(row, announce.nextSibling);
  }
  row?.setAttribute("id", "homeSearch");
  const input = document.getElementById("homeQ");
  if (input) input.placeholder = "搜花名 / 标签 / 城区 / 价位";
  if (row && !document.getElementById("btnSearchClear")) {
    const clr = document.createElement("button");
    clr.id = "btnSearchClear";
    clr.className = "btn";
    clr.type = "button";
    clr.textContent = "清除";
    const search = document.getElementById("btnSearch");
    row.insertBefore(clr, search);
  }
  if (!document.getElementById("searchHint")) {
    const hint = document.createElement("p");
    hint.id = "searchHint";
    hint.className = "muted";
    hint.style.margin = "0 0 8px";
    row?.after(hint);
  }
  const origSet = URLSearchParams.prototype.set;
  document.addEventListener("click", (ev) => {
    if (ev.target && ev.target.id === "btnSearchClear") {
      if (input) input.value = "";
      document.getElementById("btnSearch")?.click();
    }
  });
  let timer = 0;
  function run() {
    const q = (input && input.value.trim()) || "";
    const hint = document.getElementById("searchHint");
    if (hint) hint.textContent = q ? ("搜索「" + q + "」·全部城市·花名/标签/城区/价位") : "";
    document.getElementById("btnSearch")?.click();
  }
  input?.addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(run, 350);
  });
  input?.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter") { ev.preventDefault(); clearTimeout(timer); run(); }
  });
})();
