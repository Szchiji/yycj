(() => {
  function decorate() {
    document.querySelectorAll("#adminListings [data-id]").forEach((el) => {
      const row = el.closest(".pick-item, .card") || el.parentElement;
      if (!row || row.querySelector("[data-fill-proxy]")) return;
      const id = el.getAttribute("data-id");
      if (!id) return;
      const title = (row.querySelector("strong") || {}).textContent || "";
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn tiny";
      btn.textContent = "填入修改";
      btn.setAttribute("data-fill-proxy", id);
      btn.setAttribute("data-title", title);
      (row.querySelector(".row") || row).appendChild(btn);
    });
  }
  const box = document.getElementById("adminListings");
  if (box) new MutationObserver(decorate).observe(box, { childList: true, subtree: true });
  setTimeout(decorate, 2000);
})();
