(() => {
  function role() {
    try { return JSON.parse(localStorage.getItem("yycj_user") || "{}").role || "guest"; }
    catch (e) { return "guest"; }
  }
  function apply() {
    const guest = role() === "guest";
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
  sniff();
  setTimeout(apply, 800);
  document.querySelectorAll("[data-switch]").forEach((b) => {
    b.addEventListener("click", () => setTimeout(() => { sniff(); apply(); }, 400));
  });
})();
