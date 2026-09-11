(() => {
  function role() {
    try { return JSON.parse(localStorage.getItem("yycj_user") || "{}").role || "guest"; }
    catch (e) { return "guest"; }
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
    const guest = r === "guest";
    document.querySelector('[data-nav="publish"]')?.classList.toggle("hidden", guest);
    document.querySelector('[data-nav="fav"]')?.classList.toggle("hidden", !guest);
    document.body.classList.toggle("role-guest", guest);
    document.body.classList.toggle("role-host", !guest);
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
  setTimeout(() => { apply(); showHome(); }, 500);
  document.querySelectorAll("[data-switch]").forEach((b) => {
    b.addEventListener("click", () => setTimeout(() => { sniff(); apply(); showHome(); }, 400));
  });
})();
