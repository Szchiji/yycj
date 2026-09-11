(() => {
  if (window.__yycjDetailExtras) return;
  window.__yycjDetailExtras = true;
  const token = () => localStorage.getItem("yycj_token") || "";
  if (!document.getElementById("yycj-extras-css")) {
    const st = document.createElement("style");
    st.id = "yycj-extras-css";
    st.textContent = `#yycjExtras{margin:8px 0 2px;padding:0;background:none;border:none;box-shadow:none;}
#yycjExtras .ex-line{display:flex;gap:8px;align-items:baseline;margin:4px 0;font-size:.92rem;line-height:1.45;color:inherit;}
#yycjExtras .ex-k{opacity:.72;min-width:3em;flex:0 0 auto;}
#yycjExtras .ex-v{word-break:break-all;}`;
    document.head.appendChild(st);
  }
  function paint(extras) {
    const detail = document.getElementById("detail");
    if (!detail) return;
    const data = extras && typeof extras === "object" ? extras : {};
    const keys = Object.keys(data).filter((k) => String(data[k] || "").trim());
    let box = document.getElementById("yycjExtras");
    if (!keys.length) {
      if (box) box.remove();
      return;
    }
    const card = detail.querySelector(".card") || detail;
    const row = card.querySelector(".row");
    if (!box) {
      box = document.createElement("div");
      box.id = "yycjExtras";
    }
    if (row && row.parentNode === card) card.insertBefore(box, row);
    else if (box.parentNode !== card) card.appendChild(box);
    box.innerHTML = keys.map((k) => {
      const v = String(data[k]).replace(/[<>]/g, "");
      return `<div class="ex-line"><span class="ex-k">${k}</span><span class="ex-v">${v}</span></div>`;
    }).join("");
  }
  async function load(id) {
    if (!id) return;
    try {
      const r = await fetch("/api/lamps/" + encodeURIComponent(id), { headers: { Authorization: "Bearer " + token() } });
      if (!r.ok) return;
      const data = await r.json();
      const lamp = data.lamp || data;
      paint(lamp.extras || data.extras || {});
    } catch (e) {}
  }
  document.addEventListener("click", (ev) => {
    const card = ev.target.closest("#feed [data-id], #pins [data-id], #favList [data-id]");
    if (!card) return;
    const id = card.getAttribute("data-id");
    setTimeout(() => load(id), 200);
    setTimeout(() => load(id), 800);
  });
})();
