(() => {
  if (window.__yycjLazy) return;
  window.__yycjLazy = true;
  const ready = (img) => {
    if (!img || img.dataset.lazyDone) return;
    img.dataset.lazyDone = "1";
    img.decoding = "async";
    if (!img.getAttribute("loading")) img.loading = "lazy";
  };
  const scan = () => {
    document.querySelectorAll("#feed img.thumb, #favList img.thumb, #pins img.pin-cover").forEach((img, i) => {
      if (i < 4) img.loading = "eager";
      else ready(img);
    });
  };
  document.addEventListener("DOMContentLoaded", scan);
  setTimeout(scan, 800);
})();
