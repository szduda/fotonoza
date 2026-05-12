(function () {
  var d = document.documentElement.dataset;
  if (!d.trackingBase || !d.trackingCode || !d.trackingPk) return;

  function fpSeed() {
    try {
      var k = "__fotonoza_wc_fp";
      var s = sessionStorage.getItem(k);
      if (!s) {
        s =
          (typeof crypto !== "undefined" &&
            crypto.randomUUID &&
            crypto.randomUUID()) ||
          String(Math.random()).slice(2) + String(Date.now());
        sessionStorage.setItem(k, s);
      }
      return s;
    } catch (e) {
      return "";
    }
  }

  function post(payload) {
    var url = d.trackingBase + "/purr/" + d.trackingCode;
    var lang =
      document.documentElement.lang === "pl" ? "pl" : "en";
    var body = Object.assign(
      {
        public_key: d.trackingPk,
        fp_seed: fpSeed(),
        occurred_at: new Date().toISOString(),
        locale: lang,
      },
      payload
    );
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
      mode: "cors",
    }).catch(function () {});
  }

  document.addEventListener(
    "click",
    function (e) {
      var el = e.target && e.target.closest && e.target.closest("[data-track]");
      if (!el) return;
      if (e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (typeof e.button === "number" && e.button !== 0) return;
      var name = el.getAttribute("data-track");
      if (!name) return;
      var tid = el.getAttribute("data-track-target-id");
      var href =
        el.tagName === "A" && el.getAttribute("href")
          ? el.href
          : null;
      var path = location.pathname + location.search;
      post({
        event_type: "click",
        event_name: name,
        path: path,
        target_id: tid || null,
        target_href: href,
        referrer_url: null,
      });
    },
    true
  );

  var ref = document.referrer;
  var referrerOut = ref || null;
  try {
    if (ref) {
      var ru = new URL(ref);
      if (ru.host === location.host) referrerOut = null;
    }
  } catch (err) {
    referrerOut = null;
  }
  post({
    event_type: "page_open",
    event_name: "page_open",
    path: location.pathname + location.search,
    referrer_url: referrerOut,
  });
})();
