(() => {
  const token = () => localStorage.getItem("yycj_token") || "";
  function role() {
    try { return JSON.parse(localStorage.getItem("yycj_user") || "{}").role || "guest"; }
    catch (e) { return "guest"; }
  }
  function mount() {
    const me = document.getElementById("view-me");
    if (!me) return;
    if (!document.getElementById("myReviews")) {
      const hold = document.createElement("div");
      hold.id = "myReviews";
      hold.className = "hidden";
      me.appendChild(hold);
    }
    if (role() === "guest") {
      const old = document.getElementById("myListings");
      if (old && old.parentElement) old.parentElement.remove();
      return;
    }
    if (document.getElementById("myListings")) return;
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = "<h3>我的上架</h3><div id=\"myListings\" class=\"muted\">加载中…</div>";
    const first = me.querySelector(".card");
    if (first) first.after(card);
    else me.prepend(card);
  }
  async function load() {
    mount();
    const box = document.getElementById("myListings");
    if (!box || !token() || role() === "guest") return;
    try {
      const r = await fetch("/api/me/listings", { headers: { Authorization: "Bearer " + token() } });
      const data = await r.json();
      const items = data.items || [];
      if (!items.length) {
        box.innerHTML = "<p class='muted'>还没有上架记录</p>";
        return;
      }
      box.innerHTML = items.map((x) => {
        const st = x.status === "active" ? "已上架" : x.status === "hidden" ? "已下架" : x.status;
        return `<div class="pick-item" style="margin:8px 0">
          <div><strong>${x.title || ""}</strong>
          <div class="muted">${x.city || ""} · ${st} · ${x.expires_at ? ("到期 " + String(x.expires_at).slice(0,10)) : ""}</div></div>
          <button class="btn" type="button" data-edit="${x.lamp_id}">改资料</button>
        </div>`;
      }).join("");
      box.querySelectorAll("[data-edit]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const id = btn.getAttribute("data-edit");
          const item = items.find((x) => x.lamp_id === id);
          document.querySelector('[data-nav="publish"]')?.click();
          const form = document.getElementById("publishForm");
          if (!form || !item) return;
          let h = document.getElementById("editLampId");
          if (!h) { h = document.createElement("input"); h.type = "hidden"; h.id = "editLampId"; form.appendChild(h); }
          h.value = item.lamp_id;
          const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = v || ""; };
          set("pubTitle", item.title);
          set("pubCity", item.city);
          set("pubDesc", item.description);
          set("pubPrice", item.price_text);
          set("pubDistrict", item.district);
          set("pubApprox", item.approx_label);
          set("pubTags", (item.tags || []).join(" "));
          const extras = item.extras || {};
          document.querySelectorAll("[data-extra]").forEach((inp) => {
            const k = inp.getAttribute("data-extra");
            if (k && extras[k] != null) inp.value = extras[k];
          });
          const t = document.getElementById("publishTitle");
          if (t) t.textContent = "改资料（需再审）";
        });
      });
    } catch (e) {
      box.textContent = "加载失败";
    }
  }
  document.addEventListener("click", (ev) => {
    if (ev.target && ev.target.getAttribute && ev.target.getAttribute("data-nav") === "me") setTimeout(load, 200);
  });
  if (document.readyState === "complete") { mount(); setTimeout(load, 1200); }
  else window.addEventListener("load", () => { mount(); setTimeout(load, 1200); });
})();
