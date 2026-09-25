(() => {
  const raw = window.fetch.bind(window);
  window.fetch = function (url, opts) {
    const u = String(url || "");
    if (opts && opts.body && /\/api\/(posts$|me\/listings\/)/.test(u) && String(opts.method || "GET").toUpperCase() === "POST") {
      try {
        const body = JSON.parse(opts.body);
        const a = (document.getElementById("pubHourStart")?.value || "13:00").slice(0, 5);
        const b = (document.getElementById("pubHourEnd")?.value || "00:00").slice(0, 5);
        body.extras = body.extras || {};
        body.extras._hours = a + "-" + b;
        if (!body.extras._remind_on) body.extras._remind_on = "1";
        opts = Object.assign({}, opts, { body: JSON.stringify(body) });
      } catch (e) {}
    }
    return raw(url, opts);
  };
})();
