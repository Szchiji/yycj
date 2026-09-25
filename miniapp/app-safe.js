(() => {
  const need = [
    ["topMeta", "div", "top-meta muted hidden"],
    ["cityList", "div", ""],
    ["cityClose", "button", "btn block"],
    ["rulesTitle", "h3", ""],
    ["rulesList", "ul", ""],
    ["rulesClose", "button", "btn block"],
    ["pubCity", "select", ""],
    ["meCard", "div", "card"],
    ["adminEntry", "div", "hidden"],
    ["announce", "div", "announce hidden"],
    ["feed", "div", "feed"],
    ["pins", "div", "pins"],
    ["btnCity", "button", "chip"],
    ["btnBackHome", "button", "btn ghost"],
  ];
  need.forEach(([id, tag, cls]) => {
    if (document.getElementById(id)) return;
    const el = document.createElement(tag);
    el.id = id;
    if (cls) el.className = cls;
    if (tag === "button") el.type = "button";
    document.body.appendChild(el);
  });
  const sheet = document.getElementById("citySheet");
  if (sheet && !document.querySelector("#citySheet #cityList")) {
    const list = document.getElementById("cityList");
    if (list) sheet.appendChild(list);
  }
})();
