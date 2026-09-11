(() => {
  document.getElementById("filterBar")?.remove();
  document.getElementById("searchHint")?.remove();
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
    row.insertBefore(clr, document.getElementById("btnSearch"));
  }
  document.addEventListener("click", (ev) => {
    if (ev.target && ev.target.id === "btnSearchClear") {
      if (input) input.value = "";
      document.getElementById("btnSearch")?.click();
    }
  });
  let timer = 0;
  function run() {
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
