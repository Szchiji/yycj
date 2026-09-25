(() => {
  if (!document.getElementById("yycj-click-css")) {
    const st = document.createElement("style");
    st.id = "yycj-click-css";
    st.textContent = `#boot.hidden,#gate.hidden,.sheet.hidden,#citySheet{display:none!important;pointer-events:none!important;}
#app{pointer-events:auto!important;}
#detailDock{display:none!important;}
body,html{pointer-events:auto;}`;
    document.head.appendChild(st);
  }
  window.__yycjBoot = window.__yycjBoot || {
    showBoot(msg) {
      const boot = document.querySelector("#boot");
      if (!boot) return;
      boot.classList.remove("hidden");
      document.querySelector("#gate")?.classList.add("hidden");
      document.querySelector("#app")?.classList.add("hidden");
      if (msg != null) {
        const el = document.querySelector("#bootMsg");
        if (el) el.textContent = msg;
      }
    },
    hideBoot() {
      document.querySelector("#boot")?.classList.add("hidden");
      document.querySelector("#bootRetry")?.classList.add("hidden");
    },
  };
})();
