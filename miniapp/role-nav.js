(() => {
  function role() {
    try {
      const raw = localStorage.getItem("yycj_user");
      if (raw) return (JSON.parse(raw).role || "guest");
    } catch (e) {}
    const t = document.getElementById("topMeta")?.textContent || "";
    if (t.includes("老师")) return "teacher";
    if (t.includes("商家")) return "merchant";
    return "guest";
  }
  function showHome() {
    document.querySelectorAll(".view").forEach((v) => v.classList.add("hidden"));
    document.getElementById("view-home")?.classList.remove("hidden");
    document.querySelectorAll(".nav-item").forEach((b) => {
      b.classList.toggle("active", b.getAttribute("data-nav") === "home");
    });
  }
  function apply() {
    const r = role();
    const pub = document.querySelector('[data-nav="publish"]');
    if (pub) pub.classList.toggle("hidden", r === "guest");
    document.body.classList.toggle("role-guest", r === "guest");
    document.body.classList.toggle("role-host", r === "teacher" || r === "merchant");
  }
  async function sniff() {
    const token = localStorage.getItem("yycj_token");
    if (!token) return;
    try {
      const r = await fetch("/api/me", { headers: { Authorization: "Bearer " + token } });
      const data = await r.json();
      if (data.user) localStorage.setItem("yycj_user", JSON.stringify(data.user));
    } catch (e) {}
    apply();
  }
  apply();
  showHome();
  sniff();
  setTimeout(() => { apply(); showHome(); }, 600);
  setTimeout(apply, 1600);
  document.querySelectorAll("[data-switch]").forEach((b) => {
    b.addEventListener("click", () => setTimeout(() => { sniff(); apply(); }, 400));
  });
})();
