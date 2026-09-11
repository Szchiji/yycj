(() => {
  const pane = document.getElementById("pane-venue");
  if (pane && !document.getElementById("opsPromo")) {
    const box = document.createElement("div");
    box.innerHTML = `<label>审核通过推广话术</label>
      <textarea id="opsPromo" rows="4" placeholder="发给老师的推广文案"></textarea>
      <label>过审推送频道（@channel 或 -100…，空=不推）</label>
      <input id="opsChannel" placeholder="@your_channel" />`;
    const save = document.getElementById("btnOpsSave");
    if (save) pane.insertBefore(box, save);
    else pane.appendChild(box);
  }
  document.getElementById("btnOpsSave")?.addEventListener("click", async () => {
    try {
      const token = localStorage.getItem("yycj_token") || "";
      await fetch("/api/admin/settings/extra", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({
          approve_promo_text: (document.getElementById("opsPromo") || {}).value || "",
          broadcast_channel: (document.getElementById("opsChannel") || {}).value || "",
        }),
      });
    } catch (e) { console.warn(e); }
  });
})();
