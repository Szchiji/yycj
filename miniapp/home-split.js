(() => {
  const pins = document.getElementById("pins");
  const feed = document.getElementById("feed");
  if (!pins || !feed || document.getElementById("feedSplit")) return;
  const d = document.createElement("div");
  d.id = "feedSplit";
  d.setAttribute("aria-hidden", "true");
  pins.after(d);
})();
