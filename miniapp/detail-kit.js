(() => {
  if (window.__yycjDetailKit) return;
  window.__yycjDetailKit = true;
  const token = () => localStorage.getItem("yycj_token") || "";
  function toast(msg, err) {
    const el = document.getElementById("toast");
    if (!el) return alert(msg);
    el.textContent = msg || "";
    el.classList.toggle("hidden", !msg);
    el.classList.toggle("err", !!err);
    if (msg) setTimeout(() => el.classList.add("hidden"), 3600);
  }
  if (!document.getElementById("yycj-extras-css")) {
    const st = document.createElement("style");
    st.id = "yycj-extras-css";
    st.textContent = `#yycjExtras{margin:6px 0 2px;padding:0;background:none;border:none;}
#yycjExtras .ex-line{display:flex;gap:8px;align-items:baseline;margin:4px 0;font-size:.92rem;}
#yycjExtras .ex-k{opacity:.72;min-width:3em;}
#yycjExtras .ex-v{word-break:break-all;}
#yycjExtras a, #detail a.tg-link{color:#8ec8ff;text-decoration:underline;}`;
    document.head.appendChild(st);
  }
  function tgHref(raw) {
    const s = String(raw || "").trim();
    if (!s) return "";
    if (/^(https?:\/\/|tg:\/\/)/i.test(s)) return s;
    if (s.startsWith("t.me/")) return "https://" + s;
    if (s.startsWith("@")) return "https://t.me/" + s.slice(1).replace(/^\+/, "+");
    if (/^[A-Za-z][A-Za-z0-9_]{3,31}$/.test(s)) return "https://t.me/" + s;
    return "";
  }
  function linkable(key) {
    return /联系|频道|机器人|链接|用户名|telegram|bot/i.test(String(key || ""));
  }
  function valueHtml(key, val) {
    const safe = String(val).replace(/[<>]/g, "");
    const href = tgHref(val) || (linkable(key) ? tgHref(val.replace(/^@/, "@")) : "");
    if (!href) return safe;
    return `<a class="tg-link" href="${href.replace(/"/g, "")}" data-tg="${href.replace(/"/g, "")}">${safe}</a>`;
  }
  function openTg(href) {
    const tg = window.Telegram && window.Telegram.WebApp;
    if (!href) return;
    if (tg && /t\.me\/|tg:\/\//i.test(href) && tg.openTelegramLink) tg.openTelegramLink(href);
    else if (tg && tg.openLink) tg.openLink(href);
    else location.href = href;
  }
  function ctaOn() {
    const v = (window.__yycjHome || {}).show_chat_cta;
    return !(v === false || v === 0 || v === "0" || v === "false");
  }
  function ctaLabel() {
    return String((window.__yycjHome || {}).chat_cta_label || "想聊聊").slice(0, 32);
  }
  function applyCta() {
    const on = ctaOn();
    const text = ctaLabel();
    document.querySelectorAll("#detailChat, [data-cta='chat']").forEach((btn) => {
      if (on) btn.textContent = text;
      btn.style.display = on ? "" : "none";
    });
  }
  function paintApprox(lamp) {
    const label = String((lamp && lamp.approx_label) || "").trim();
    const card = document.querySelector("#detail .card") || document.getElementById("detail");
    if (!card || !label) return;
    const loc = [...card.querySelectorAll(".muted")].find((x) => (x.textContent || "").includes("📍"));
    if (loc && !loc.dataset.approx) {
      loc.textContent = loc.textContent.replace(/\s+$/, "") + " · " + label;
      loc.dataset.approx = "1";
    }
  }
  function paintExtras(extras) {
    const detail = document.getElementById("detail");
    if (!detail) return;
    const data = extras && typeof extras === "object" ? extras : {};
    const keys = Object.keys(data).filter((k) => !String(k).startsWith("_") && String(data[k] || "").trim());
    let box = document.getElementById("yycjExtras");
    if (!keys.length) { if (box) box.remove(); return; }
    const card = detail.querySelector(".card") || detail;
    const row = card.querySelector(".row");
    if (!box) { box = document.createElement("div"); box.id = "yycjExtras"; }
    if (row && row.parentNode === card) card.insertBefore(box, row);
    else if (box.parentNode !== card) card.appendChild(box);
    box.innerHTML = keys.map((k) => `<div class="ex-line"><span class="ex-k">${k}</span><span class="ex-v">${valueHtml(k, data[k])}</span></div>`).join("");
  }
  function placeShare(id) {
    document.querySelector("#yycjGallery #detailShare, #yycjGallery [data-share]")?.remove();
    const rev = document.getElementById("detailReview");
    if (!rev) return;
    let btn = document.getElementById("detailShare");
    if (!btn) {
      btn = document.createElement("button");
      btn.id = "detailShare";
      btn.className = "btn";
      btn.type = "button";
      btn.textContent = "分享";
      rev.insertAdjacentElement("afterend", btn);
    }
    if (id) btn.setAttribute("data-share", id);
  }
  function paintReviews(list, id) {
    const detail = document.getElementById("detail");
    if (!detail) return;
    let box = document.getElementById("yycjReviews");
    if (!box) { box = document.createElement("div"); box.id = "yycjReviews"; detail.appendChild(box); }
    const rows = list && list.length ? list.map((t) => {
      const stars = "★".repeat(t.stars || 0) + "☆".repeat(Math.max(0, 5 - (t.stars || 0)));
      return `<div class="card" style="margin:8px 0"><div class="muted">${stars}</div><p>${String(t.text || "").replace(/[<>]/g,"")}</p></div>`;
    }).join("") : "<p class='muted'>暂无评价</p>";
    box.innerHTML = `<h3 style="font-size:1rem;margin:12px 0 6px">评价</h3>${rows}`;
    placeShare(id);
  }
  function tune(v) {
    if (!v || v.dataset.tuned) return;
    v.dataset.tuned = "1";
    v.muted = true;
    v.autoplay = true;
    v.loop = true;
    v.controls = false;
    v.playsInline = true;
    v.preload = "metadata";
    v.play().catch(() => {});
  }
  async function loadLamp(id) {
    if (!id) return;
    window.__yycjOpenLamp = id;
    try {
      const r = await fetch("/api/lamps/" + encodeURIComponent(id), { headers: { Authorization: "Bearer " + token() } });
      if (!r.ok) return;
      const data = await r.json();
      const lamp = data.lamp || data;
      paintApprox(lamp);
      paintExtras(lamp.extras || data.extras || {});
      paintReviews(data.reviews || data.approved_reviews || lamp.reviews || [], id);
      applyCta();
    } catch (e) {}
  }
  async function loadHomeOnce() {
    if (window.__yycjHome && window.__yycjHome.chat_cta_label) { applyCta(); return; }
    try {
      const r = await fetch("/api/home?limit=1", { headers: { Authorization: "Bearer " + token() } });
      window.__yycjHome = Object.assign({}, window.__yycjHome || {}, await r.json());
      applyCta();
    } catch (e) {}
  }
  document.addEventListener("click", (ev) => {
    const a = ev.target.closest("a[data-tg], #detail a.tg-link, #yycjExtras a");
    if (a) {
      ev.preventDefault();
      ev.stopPropagation();
      openTg(a.getAttribute("data-tg") || a.getAttribute("href") || "");
      return;
    }
    const card = ev.target.closest("#feed [data-id], #pins [data-id], #favList [data-id]");
    if (!card) return;
    const id = card.getAttribute("data-id");
    window.__yycjOpenLamp = id;
    setTimeout(() => loadLamp(id), 180);
  }, true);
  document.addEventListener("click", async (ev) => {
    const btn = ev.target.closest("#detailChat");
    if (!btn) return;
    ev.preventDefault();
    ev.stopPropagation();
    const id = window.__yycjOpenLamp || btn.getAttribute("data-lamp") || "";
    if (!id) return toast("找不到这条资料", true);
    btn.disabled = true;
    try {
      const r = await fetch("/api/sessions/request", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + token() },
        body: JSON.stringify({ lamp_id: id }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.detail || "发起失败");
      toast(data.message || "已发送想聊聊");
    } catch (e) {
      toast(e.message || String(e), true);
    } finally {
      btn.disabled = false;
    }
  }, true);
  const view = document.getElementById("view-detail");
  if (view) {
    new MutationObserver(() => {
      view.querySelectorAll("video").forEach(tune);
      applyCta();
      const id = document.getElementById("detail")?.getAttribute("data-lamp") || "";
      if (id && document.getElementById("detailReview")) placeShare(id);
    }).observe(view, { childList: true, subtree: true });
  }
  loadHomeOnce();
})();
