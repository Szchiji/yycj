(() => {
  if (document.getElementById("filterBar")) return;
  const css = document.createElement("style");
  css.textContent = `#filterBar{display:grid;grid-template-columns:1fr 1fr;gap:8px;background:#151b2f;border:1px solid #2a3352;border-radius:16px;padding:10px;margin:0 0 10px;}
#filterBar select{margin:0;background:#0d1326;border:1px solid #2a3352;border-radius:12px;color:#e8ecff;padding:10px 12px;font-size:.9rem;}`;
  document.head.appendChild(css);
  const bar = document.createElement("div");
  bar.id = "filterBar";
  bar.innerHTML = `
    <select id="fltCity"><option value="">城市</option></select>
    <select id="fltDistrict"><option value="">地区</option></select>
    <select id="fltTag"><option value="">标签</option></select>
    <select id="fltSort">
      <option value="">综合评价</option>
      <option value="score">口碑从高到低</option>
      <option value="new">最新上架</option>
      <option value="price">价位从低到高</option>
    </select>`;
  const hint = document.getElementById("searchHint");
  const row = document.getElementById("homeSearch") || document.querySelector(".search-row");
  const pins = document.getElementById("pins");
  if (hint) hint.after(bar);
  else if (row) row.after(bar);
  else if (pins) pins.before(bar);

  function uniq(arr) { return [...new Set(arr.filter(Boolean))]; }
  function fillSelect(sel, values, placeholder) {
    if (!sel) return;
    const cur = sel.value;
    sel.innerHTML = `<option value="">${placeholder}</option>` + values.map((v) => `<option value="${v}">${v}</option>`).join("");
    if (values.includes(cur)) sel.value = cur;
  }
  function readCard(c) {
    const loc = (c.querySelector(".badge-loc") || {}).textContent || "";
    const parts = loc.split("·").map((s) => s.trim()).filter(Boolean);
    if (!c.getAttribute("data-district") && parts[1]) c.setAttribute("data-district", parts[1]);
    const tag = ((c.querySelector(".badge-tag") || {}).textContent || "").trim();
    if (!c.getAttribute("data-tags") && tag) c.setAttribute("data-tags", tag);
    const price = ((c.querySelector(".price") || {}).textContent || "").replace(/\D/g, "");
    if (!c.getAttribute("data-price") && price) c.setAttribute("data-price", price);
  }
  function harvest() {
    const cards = [...document.querySelectorAll("#feed [data-id]")];
    cards.forEach(readCard);
    fillSelect(document.getElementById("fltDistrict"), uniq(cards.map((c) => c.getAttribute("data-district"))), "地区");
    const tags = [];
    cards.forEach((c) => (c.getAttribute("data-tags") || "").split(",").forEach((t) => tags.push(t.trim())));
    fillSelect(document.getElementById("fltTag"), uniq(tags), "标签");
    const cities = [...document.querySelectorAll("#cityDrop [data-city]")].map((b) => b.getAttribute("data-city"));
    fillSelect(document.getElementById("fltCity"), uniq(cities), "城市");
    const saved = localStorage.getItem("yycj_city") || "";
    const citySel = document.getElementById("fltCity");
    if (citySel && saved) citySel.value = saved;
  }
  function apply() {
    const district = (document.getElementById("fltDistrict") || {}).value || "";
    const tag = (document.getElementById("fltTag") || {}).value || "";
    const sort = (document.getElementById("fltSort") || {}).value || "";
    const feed = document.getElementById("feed");
    if (!feed) return;
    const cards = [...feed.querySelectorAll("[data-id]")];
    cards.forEach(readCard);
    cards.forEach((c) => {
      const okD = !district || c.getAttribute("data-district") === district;
      const okT = !tag || (c.getAttribute("data-tags") || "").split(",").includes(tag);
      c.style.display = okD && okT ? "" : "none";
    });
    const shown = cards.filter((c) => c.style.display !== "none");
    if (sort === "score") shown.sort((a, b) => Number(b.dataset.score || 0) - Number(a.dataset.score || 0));
    if (sort === "price") shown.sort((a, b) => Number(a.dataset.price || 0) - Number(b.dataset.price || 0));
    if (sort === "new") shown.reverse();
    shown.forEach((c) => feed.appendChild(c));
  }
  document.getElementById("fltCity")?.addEventListener("change", () => {
    const v = document.getElementById("fltCity").value;
    if (v) {
      localStorage.setItem("yycj_city", v);
      document.querySelector('#cityDrop [data-city="' + v + '"]')?.click();
    }
  });
  ["fltDistrict", "fltTag", "fltSort"].forEach((id) => {
    document.getElementById(id)?.addEventListener("change", apply);
  });
  const feed = document.getElementById("feed");
  if (feed) new MutationObserver(() => { harvest(); }).observe(feed, { childList: true });
  setTimeout(harvest, 800);
})();
