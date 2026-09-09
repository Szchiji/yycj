(async () => {
  const [a, b] = await Promise.all([
    fetch("./app.p1.js?v=20260910").then((r) => r.text()),
    fetch("./app.p2.js?v=20260910").then((r) => r.text()),
  ]);
  (0, eval)(a + b);
})().catch((e) => {
  console.error(e);
  const el = document.querySelector("#bootMsg");
  if (el) el.textContent = "脚本加载失败，请重试";
  document.querySelector("#bootRetry")?.classList.remove("hidden");
});
