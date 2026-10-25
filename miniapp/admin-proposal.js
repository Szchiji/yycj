// Admin button-layout proposal (branch only). Re-arranges existing buttons; every button keeps its handlers.
(() => {
  if (window.__yycjAdminProposal) return;
  window.__yycjAdminProposal = true;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  function actRow(row) {
    if (!row || row.dataset.pp || row.closest("form") || row.closest(".ad-more-menu")) return;
    const kids = [...row.children].filter((k) => k.matches("button, a.btn, .ad-more"));
    if (!kids.length || kids.length !== [...row.children].filter((k) => !k.classList.contains("a-gap")).length) return;
    row.dataset.pp = "1";
    row.classList.add("act-row");
    const host = row.parentNode;
    if (host && host.classList.contains("pick-item")) host.classList.add("stack");
    kids.forEach((k) => {
      const b = k.matches(".ad-more") ? k.querySelector(".btn") : k;
      const cls = k.classList.contains("danger") ? "a-danger" : (b && b.classList.contains("primary")) ? "a-primary" : "a-sec";
      k.classList.add(cls);
    });
    if (!row.querySelector(":scope > .a-gap")) { const g = document.createElement("span"); g.className = "a-gap"; row.appendChild(g); }
  }
  function moveBadge(card) {
    const diff = card.querySelector(":scope > .edit-diff");
    if (!diff) return;
    let head = card.querySelector(":scope > .card-head");
    if (!head) {
      const idLine = card.firstElementChild;
      if (!idLine || idLine === diff) return;
      head = document.createElement("div");
      head.className = "card-head";
      idLine.before(head);
      head.appendChild(idLine);
    }
    head.appendChild(diff);
  }
  function postCard(card) {
    if (card.dataset.pp) return;
    const ok = card.querySelector('[data-admin="post-ok"]');
    if (!ok) return;
    card.dataset.pp = "1";
    card.classList.add("post-card");
    // media → compact strip (videos become tiles: tap = full screen)
    const media = [...card.children].filter((n) => n.matches("img, video"));
    if (media.length) {
      const strip = document.createElement("div");
      strip.className = "media-strip";
      media[0].before(strip);
      media.forEach((m) => {
        if (m.tagName === "VIDEO") {
          const tile = document.createElement("button");
          tile.type = "button";
          tile.className = "vtile";
          m.removeAttribute("controls");
          m.preload = "metadata";
          m.muted = true;
          tile.appendChild(m);
          tile.addEventListener("click", () => { m.controls = true; m.muted = false; (m.requestFullscreen || m.webkitEnterFullscreen || (() => {})).call(m); m.play().catch(() => {}); });
          m.addEventListener("fullscreenchange", () => { if (!document.fullscreenElement) { m.pause(); m.controls = false; } });
          strip.appendChild(tile);
        } else strip.appendChild(m);
      });
    }
    // 通过并上轮播 → a toggle; 通过 does the right call
    const pin = card.querySelector('[data-admin="post-pin"]');
    if (pin) {
      pin.style.display = "none";
      pin.classList.add("pp-hidden");
      const t = document.createElement("label");
      t.className = "pin-toggle";
      t.innerHTML = `<span>通过后同时上精选轮播（72 小时）</span><input type="checkbox" class="sw" />`;
      ok.parentNode.before(t);
      ok.textContent = "通过";
      t.querySelector("input").addEventListener("change", (e) => { ok.textContent = e.target.checked ? "通过并上轮播" : "通过"; });
    }
  }
  document.addEventListener("click", (ev) => {
    const ok = ev.target.closest('[data-admin="post-ok"]');
    if (!ok) return;
    const card = ok.closest(".card");
    const sw = card && card.querySelector(".pin-toggle input");
    const pin = card && card.querySelector('[data-admin="post-pin"]');
    if (sw && sw.checked && pin) { ev.preventDefault(); ev.stopPropagation(); pin.click(); }
  }, true);
  function listings() {
    const pane = $("#pane-listings");
    const list = $("#adminListings");
    if (!pane || !list) return;
    [["proxyBox", "代老师上架（免审）"], ["editBox", "代修改资料（免审）"]].forEach(([id, label]) => {
      const box = document.getElementById(id);
      if (!box || box.parentNode.matches("details.fold")) return;
      const d = document.createElement("details");
      d.className = "fold";
      d.id = id + "Fold";
      d.innerHTML = `<summary>${label}</summary>`;
      pane.appendChild(d);
      d.appendChild(box);
    });
  }
  document.addEventListener("click", (ev) => {
    if (!ev.target.closest("[data-fill-proxy]")) return;
    setTimeout(() => { const d = $("#editBoxFold"); if (d) { d.open = true; d.scrollIntoView({ block: "start", behavior: "smooth" }); } }, 60);
  }, true);
  // Settings: reuse the existing #adSaveBar (admin-ux.js) but keep it on screen for the whole 站点设置 pane,
  // with a clear state line; the in-page "保存全部设置" at the very bottom is no longer needed.
  function venue() {
    const bar = $("#adSaveBar");
    const save = $("#btnOpsSave");
    if (!bar || !save) return;
    const label = bar.querySelector("span");
    const dirty = document.body.classList.contains("ops-dirty");
    const want = dirty ? "有未保存的修改" : "设置已是最新";
    if (label && label.textContent !== want) label.textContent = want;
    bar.classList.toggle("is-dirty", dirty);
    const now = $("#adSaveNow");
    if (now && now.textContent !== "保存全部设置") now.textContent = "保存全部设置";
    save.classList.add("pp-hidden");
    const sync = $("#btnSyncBot");
    const contact = $("#opsAdminContact")?.closest(".ops-card");
    if (sync && contact && sync.parentNode !== contact) { sync.classList.add("block"); contact.appendChild(sync); }
  }
  function syncPane() {
    const act = $(".admin-pane.active");
    document.body.classList.toggle("pane-venue", !!act && act.id === "pane-venue");
  }
  function decorate() {
    $$("#adminPosts > .card").forEach((c) => { postCard(c); moveBadge(c); });
    $$(".admin-pane .card > .row, .admin-pane .pick-item > .row, .admin-pane .ops-card > .row").forEach(actRow);
    $$(".pick-item").forEach((it) => {
      if (!it.classList.contains("pick-add") && it.querySelector(":scope > .hrs")) it.classList.add("pick-add");
      if (!it.classList.contains("user-item") && it.querySelector("[data-ban]")) it.classList.add("user-item");
    });
    $$(".pick-now .pick-actions .btn.danger").forEach((b) => {
      if (b.dataset.pp) return;
      b.dataset.pp = "1";
      b.textContent = b.closest("#adminPins") ? "轮播中 · 移除" : "置顶中 · 取消";
    });
    listings();
    venue();
    syncPane();
  }
  let queued = false;
  const root = document.getElementById("console") || document.body;
  new MutationObserver(() => {
    if (queued) return;
    queued = true;
    setTimeout(() => { queued = false; decorate(); }, 0);
  }).observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["class"] });
  new MutationObserver(() => venue()).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  decorate();
})();
