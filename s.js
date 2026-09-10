/* toodip stats — lekki licznik wejsc (page views).
   Wklejasz na strone klienta:
   <script defer src="https://stats.toodip.pl/s.js" data-id="WEBSITE_ID"></script>
   (opcjonalnie data-host="..." gdy testujesz na innej domenie) */
(function () {
  var el = document.currentScript || document.querySelector('script[data-id]');
  var id = el && el.getAttribute('data-id');
  if (!id) return;

  /* host = skad zaladowano ten skrypt (dziala na dowolnej domenie, .pl/.com/…) */
  var host = el.getAttribute('data-host');
  if (!host && el.src) { try { host = new URL(el.src).origin; } catch (e) {} }
  host = (host || 'https://stats.toodip.pl').replace(/\/+$/, '');
  var endpoint = host + '/api/collect';

  function hit() {
    var body = JSON.stringify({ id: id, p: location.pathname, r: document.referrer || '' });
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, new Blob([body], { type: 'text/plain' }));
        return;
      }
    } catch (e) {}
    try {
      fetch(endpoint, { method: 'POST', body: body, headers: { 'Content-Type': 'text/plain' }, keepalive: true, mode: 'no-cors' });
    } catch (e) {}
  }

  hit();

  var last = location.pathname;
  function spa() { if (location.pathname !== last) { last = location.pathname; hit(); } }
  if (history.pushState) {
    var push = history.pushState;
    history.pushState = function () { push.apply(this, arguments); spa(); };
    window.addEventListener('popstate', spa);
  }
})();
