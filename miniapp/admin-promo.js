(() => {
  const pane = document.getElementById("pane-venue");
  if (!pane || document.getElementById("opsPromo")) return;
  const box = document.createElement("div");
  box.innerHTML = `<label>审核通过推广话术（发给老师）</label>
    <textarea id="opsPromo" rows="4" placeholder="欢迎把月影车姬介绍给朋友…"></textarea>`;
  const save = document.getElementById("btnOpsSave");
  if (save) pane.insertBefore(box, save);
  else pane.appendChild(box);

  const orig = document.getElementById("btnOpsSave");
  orig?.addEventListener("click", async () => {
    try {
      const token = localStorage.getItem("yycj_token") || "";
      await fetch("/api/admin/settings/extra", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({ approve_promo_text: (document.getElementById("opsPromo") || {}).value || "" }),
      });
    } catch (e) { console.warn(e); }
  });
})();
