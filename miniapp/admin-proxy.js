(() => {
  const pane = document.getElementById("pane-listings");
  if (!pane || document.getElementById("proxyBox")) return;
  const box = document.createElement("div");
  box.id = "proxyBox";
  box.className = "card";
  box.innerHTML = `<h3>代老师上架</h3>
    <p class="muted">资料挂在老师 ID 上，客人点联系会打给老师。老师需先 /start 过机器人。</p>
    <label>老师用户 ID</label><input id="proxyUid" type="number" />
    <label>称呼</label><input id="proxyTitle" />
    <label>城市</label><input id="proxyCity" placeholder="深圳" />
    <label>价位</label><input id="proxyPrice" />
    <label>简介</label><textarea id="proxyDesc" rows="3"></textarea>
    <label>图片 URL 或 file_id（一行一个）</label><textarea id="proxyMedia" rows="3"></textarea>
    <button class="btn primary" type="button" id="btnProxy">直接上架</button>`;
  pane.prepend(box);
  document.getElementById("btnProxy")?.addEventListener("click", async () => {
    const token = localStorage.getItem("yycj_token") || "";
    const lines = (document.getElementById("proxyMedia").value || "").split("\n").map((s) => s.trim()).filter(Boolean);
    const media = lines.map((u) => ({ type: "image", url: u }));
    try {
      const r = await fetch("/api/admin/listings/proxy", {
        method: "POST",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        body: JSON.stringify({
          target_user_id: parseInt(document.getElementById("proxyUid").value, 10),
          title: document.getElementById("proxyTitle").value,
          city: document.getElementById("proxyCity").value,
          price_text: document.getElementById("proxyPrice").value,
          description: document.getElementById("proxyDesc").value,
          media,
          publisher_role: "teacher",
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || "失败");
      alert("已代上架：" + ((data.lamp || {}).title || ""));
      document.getElementById("btnRefresh")?.click();
    } catch (e) { alert(e.message || String(e)); }
  });
})();
