(() => {
  const box = document.getElementById("opsChats");
  if (!box) return;
  box.placeholder = "一行一个，例如\n-1001234567890\n@yourchannel";
  const label = box.previousElementSibling;
  if (label && label.tagName === "LABEL") label.textContent = "必订频道 ID（一行一个，可填 -100… 或 @用户名）";
  const token = () => localStorage.getItem("yycj_token") || "";
  async function fill() {
    try {
      const r = await fetch("/api/admin/homepage", { headers: { Authorization: "Bearer " + token() } });
      const data = await r.json();
      const settings = data.settings || data;
      const chats = settings.required_chats || (settings.ops && settings.ops.required_chats) || [];
      const lines = chats.map((c) => {
        if (typeof c === "string") return c;
        return c.chat_id || c.id || c.username || "";
      }).filter(Boolean);
      if (lines.length && !box.value.trim()) box.value = lines.join("\n");
    } catch (e) {}
  }
  setTimeout(fill, 1200);
  document.getElementById("btnRefresh")?.addEventListener("click", () => setTimeout(fill, 500));
})();
