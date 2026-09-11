(() => {
  function restore(raw) {
    let s = String(raw || "").trim();
    if (!s) return "";
    if (s.startsWith("s_")) s = s.slice(2);
    s = s.replace(/-/g, "");
    if (s.length === 32) {
      return s.slice(0, 8) + "-" + s.slice(8, 12) + "-" + s.slice(12, 16) + "-" + s.slice(16, 20) + "-" + s.slice(20);
    }
    return String(raw || "").replace(/^s_/, "");
  }
  function lampId() {
    const q = new URLSearchParams(location.search || "");
    const fromQ = q.get("lamp") || q.get("id") || "";
    if (fromQ) return restore(fromQ) || fromQ;
    const tg = window.Telegram && window.Telegram.WebApp;
    const sp = (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || "";
    if (sp) return restore(sp);
    return localStorage.getItem("yycj_open_lamp") || "";
  }
  function showDetail() {
    document.getElementById("boot")?.classList.add("hidden");
    document.getElementById("gate")?.classList.add("hidden");
    document.getElementById("app")?.classList.remove("hidden");
    document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
    document.getElementById("view-detail")?.classList.remove("hidden");
  }
  async function openLamp(id) {
    if (!id) return;
    localStorage.setItem("yycj_open_lamp", id);
    const feed = document.getElementById("feed");
    if (feed) {
      const ghost = document.createElement("div");
      ghost.setAttribute("data-id", id);
      ghost.style.display = "none";
      feed.appendChild(ghost);
      ghost.click();
      setTimeout(() => ghost.remove(), 800);
    }
    showDetail();
    const token = localStorage.getItem("yycj_token") || "";
    if (!token) return;
    try {
      const r = await fetch("/api/lamps/" + encodeURIComponent(id), { headers: { Authorization: "Bearer " + token } });
      if (r.ok) showDetail();
    } catch (e) {}
  }
  async function boot() {
    const id = lampId();
    if (!id) return;
    for (let i = 0; i < 40 && !localStorage.getItem("yycj_token"); i += 1) {
      await new Promise((r) => setTimeout(r, 100));
    }
    await openLamp(id);
    setTimeout(() => openLamp(id), 800);
    setTimeout(() => {
      if (!document.getElementById("view-detail") || document.getElementById("view-detail").classList.contains("hidden")) {
        openLamp(id);
      } else {
        localStorage.removeItem("yycj_open_lamp");
      }
    }, 2000);
  }
  if (document.readyState === "complete") boot();
  else window.addEventListener("load", boot);
})();
