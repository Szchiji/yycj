(() => {
  let once = false;
  async function assignGuest() {
    const token = localStorage.getItem("yycj_token") || "";
    if (!token) return;
    try {
      const r = await fetch("/api/me/role", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ role: "guest" }),
      });
      const data = await r.json();
      if (data.user) localStorage.setItem("yycj_user", JSON.stringify(data.user));
    } catch (e) {}
  }
  async function rescue() {
    const app = document.getElementById("app");
    const gate = document.getElementById("gate");
    const boot = document.getElementById("boot");
    const gateOn = gate && !gate.classList.contains("hidden");
    const emptyGate = gateOn && !(gate.textContent || "").trim();
    const bothHidden = app && app.classList.contains("hidden") && boot && boot.classList.contains("hidden");
    if (!emptyGate && !bothHidden) return;
    if (!once) {
      once = true;
      await assignGuest();
    }
    gate?.classList.add("hidden");
    boot?.classList.add("hidden");
    app?.classList.remove("hidden");
    document.querySelectorAll(".view").forEach((v) => {
      if (v.id !== "view-home" && v.id !== "view-detail") v.classList.add("hidden");
    });
    document.getElementById("view-home")?.classList.remove("hidden");
  }
  setTimeout(rescue, 600);
  setTimeout(rescue, 1600);
  setInterval(rescue, 2500);
})();
