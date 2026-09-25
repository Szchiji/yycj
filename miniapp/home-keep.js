(() => {
  const feed = document.getElementById("feed");
  if (!feed) return;
  let busy = false;
  function recover() {
    if (busy) return;
    if ((feed.innerHTML || "").trim()) return;
    if (typeof window.__yycjPaintHomeNow === "function") {
      busy = true;
      Promise.resolve(window.__yycjPaintHomeNow()).finally(() => { busy = false; });
    }
  }
  new MutationObserver(() => setTimeout(recover, 50)).observe(feed, { childList: true });
  setTimeout(recover, 1500);
  setTimeout(recover, 3500);
})();
