(() => {
  if (window.__yycjPubFields) return;
  window.__yycjPubFields = true;
  const FORM_MAP = {
    "称呼": "pubTitle",
    "城市": "pubCity",
    "简介": "pubDesc",
    "价位": "pubPrice",
    "区域": "pubDistrict",
    "大致位置": "pubApprox",
    "标签": "pubTags",
  };
  const LABELS = { pubPrice: "价位", pubDistrict: "区域", pubApprox: "大致位置", pubTags: "标签" };
  function unwrap() {
    const form = document.getElementById("publishForm");
    const det = form && form.querySelector("details.advanced");
    if (!form || !det) return;
    ["pubPrice", "pubDistrict", "pubApprox", "pubTags"].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      if (!(el.previousElementSibling && el.previousElementSibling.tagName === "LABEL")) {
        const lab = document.createElement("label");
        lab.textContent = LABELS[id] || id;
        form.insertBefore(lab, det);
      } else {
        form.insertBefore(el.previousElementSibling, det);
      }
      form.insertBefore(el, det);
    });
    det.remove();
  }
  function extraWrap() {
    let el = document.getElementById("pubExtras");
    if (el) return el;
    const form = document.getElementById("publishForm");
    if (!form) return null;
    el = document.createElement("div");
    el.id = "pubExtras";
    form.insertBefore(el, form.querySelector("button[type=submit]") || null);
    return el;
  }
  function toggleInput(id, on) {
    const el = document.getElementById(id);
    if (!el) return;
    const lab = el.previousElementSibling;
    el.style.display = on ? "" : "none";
    if (lab && lab.tagName === "LABEL") lab.style.display = on ? "" : "none";
    if (!on) el.removeAttribute("required");
  }
  async function load() {
    unwrap();
    const wrap = extraWrap();
    if (!wrap) return;
    let fields = [];
    try {
      const token = localStorage.getItem("yycj_token") || "";
      const r = await fetch("/api/home?limit=1", { headers: { Authorization: "Bearer " + token } });
      const data = await r.json();
      fields = Array.isArray(data.listing_fields) ? data.listing_fields : [];
    } catch (e) {}
    const enabled = (fields.length ? fields : Object.keys(FORM_MAP).map((k) => ({ key: k, form: true })))
      .filter((f) => f && f.key && f.form !== false && f.key !== "地点" && f.key !== "链接")
      .map((f) => String(f.key));
    Object.keys(FORM_MAP).forEach((key) => toggleInput(FORM_MAP[key], enabled.includes(key)));
    wrap.innerHTML = enabled.filter((k) => !FORM_MAP[k]).map((k) => {
      const safe = k.replace(/"/g, "");
      return `<label>${safe}</label><input data-extra="${safe}" maxlength="64" placeholder="${safe}" />`;
    }).join("");
  }
  const origFetch = window.fetch;
  window.fetch = function (url, opt) {
    try {
      const u = String(url || "");
      if ((u.includes("/api/posts") || u.includes("/api/me/listings")) && opt && typeof opt.body === "string") {
        const extras = {};
        document.querySelectorAll("[data-extra]").forEach((inp) => {
          const v = (inp.value || "").trim();
          if (v) extras[inp.getAttribute("data-extra")] = v;
        });
        const body = JSON.parse(opt.body);
        body.extras = extras;
        opt = Object.assign({}, opt, { body: JSON.stringify(body) });
      }
    } catch (e) {}
    return origFetch.apply(this, [url, opt]);
  };
  setTimeout(load, 500);
  document.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-nav='publish'], [data-view='publish']")) setTimeout(load, 150);
  });
})();
