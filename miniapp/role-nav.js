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
  apply();
  setTimeout(apply, 800);
})();
