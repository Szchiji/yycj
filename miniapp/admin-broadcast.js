(() => {
  if (window.__yycjAdminBroadcast) return;
  window.__yycjAdminBroadcast = true;
  const token = () => localStorage.getItem("yycj_token") || "";
  const $ = (id) => document.getElementById(id);
  document.addEventListener("click", async (ev) => {
    if (!ev.target || ev.target.id !== "btnOpsSave") return;
    try {
      await fetch("/api/admin/settings/extra", {
        method: "POST",
        headers: { Authorization: "Bearer " + token(), "Content-Type": "application/json" },
        body: JSON.stringify({
          broadcast_channel: ($("opsChannel") && $("opsChannel").value.trim()) || "",
          broadcast_template: ($("opsBroadcastTpl") && $("opsBroadcastTpl").value) || "",
          media_channel_id: ($("opsMediaChannel") && $("opsMediaChannel").value.trim()) || "",
        }),
      });
    } catch (e) {}
  }, true);
  setTimeout(async () => {
    try {
      const r = await fetch("/api/admin/homepage", { headers: { Authorization: "Bearer " + token() } });
      const s = (await r.json()).settings || {};
      if ($("opsChannel") && s.broadcast_channel) $("opsChannel").value = s.broadcast_channel;
      if ($("opsBroadcastTpl") && s.broadcast_template) $("opsBroadcastTpl").value = s.broadcast_template;
      if ($("opsMediaChannel") && s.media_channel_id) $("opsMediaChannel").value = s.media_channel_id;
    } catch (e) {}
  }, 1200);
})();
