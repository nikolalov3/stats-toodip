/* toodip stats — lekki licznik wejsc (page views) + zdarzenia-pieniadze (konwersje).
   Wklejasz na strone klienta:
   <script defer src="https://stats.toodip.com/s.js" data-id="WEBSITE_ID"></script>
   (opcjonalnie data-host="..." gdy testujesz na innej domenie)

   Zdarzenia:
   - auto: klik w tel:, w mapy/nawigacje, w Instagram, w Facebook
   - recznie: toodip('rezerwacja')  // lub dowolna nazwa
   - deklaratywnie: <a data-toodip="rezerwacja" ...>  */
(function () {
  var el = document.currentScript || document.querySelector('script[data-id]');
  var id = el && el.getAttribute('data-id');
  if (!id) return;

  /* Licz tylko realne strony http(s). Podglady linkow i renderery AI/botow
     wczytuja HTML jako data:/blob:/about: — location.pathname jest wtedy calym
     dokumentem, co smiecilo liste stron. Takie odslony pomijamy. */
  if (location.protocol !== 'http:' && location.protocol !== 'https:') return;

  /* host = skad zaladowano ten skrypt (dziala na dowolnej domenie, .pl/.com/…) */
  var host = el.getAttribute('data-host');
  if (!host && el.src) { try { host = new URL(el.src).origin; } catch (e) {} }
  host = (host || 'https://stats.toodip.com').replace(/\/+$/, '');
  var endpoint = host + '/api/collect';

  /* Trwaly, pierwszy-party identyfikator odwiedzajacego: losowy, bez zadnych
     danych osobowych, trzymany w localStorage TEJ strony (osobny per domena,
     wiec nie da sie sledzic miedzy witrynami). Dzieki niemu ta sama osoba na
     tym samym urzadzeniu nie liczy sie drugi raz w kolejnym dniu. Gdy
     localStorage jest niedostepny, serwer wraca do dziennego hasha IP+UA. */
  function vid() {
    try {
      var k = 'tdp_vid', v = localStorage.getItem(k);
      if (!v) {
        v = (window.crypto && crypto.randomUUID)
          ? crypto.randomUUID()
          : (Date.now().toString(16) + Math.random().toString(16).slice(2, 10));
        localStorage.setItem(k, v);
      }
      return v;
    } catch (e) { return ''; }
  }

  function send(extra) {
    var payload = {
      id: id,
      p: location.pathname,
      q: location.search || '',            // query osobno: pozwala wykryc otagowane linki (utm_source=chatgpt)
      vid: vid(),                          // trwaly identyfikator (unikalni miedzy dniami)
      r: document.referrer || '',
      t: (document.title || '').slice(0, 200),
      l: (navigator.language || document.documentElement.lang || '').slice(0, 10)
    };
    if (extra) { for (var k in extra) payload[k] = extra[k]; }
    var body = JSON.stringify(payload);
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

  function hit() { send(); }                          // page view
  function track(name) {                              // zdarzenie (konwersja)
    if (!name) return;
    send({ e: String(name).slice(0, 40) });
  }

  /* publiczne API: toodip('rezerwacja') */
  window.toodip = function (name) { track(name); };

  /* auto-wykrywanie zdarzen-pieniedzy z klikow w linki */
  function nameFor(href, node) {
    var explicit = node && node.getAttribute && node.getAttribute('data-toodip');
    if (explicit) return explicit.slice(0, 40);
    if (!href) return null;
    var h = href.toLowerCase();
    if (h.indexOf('tel:') === 0) return 'phone';
    if (h.indexOf('mailto:') === 0) return 'email';
    if (h.indexOf('sms:') === 0 || h.indexOf('whatsapp') >= 0 || h.indexOf('wa.me') >= 0) return 'whatsapp';
    if (h.indexOf('geo:') === 0 || /maps\.google|google\.[a-z.]+\/maps|maps\.app\.goo\.gl|goo\.gl\/maps/.test(h)) return 'directions';
    if (/(^|\.)instagram\.com/.test(h) || h.indexOf('instagr.am') >= 0) return 'instagram';
    if (/(^|\.)facebook\.com/.test(h) || h.indexOf('fb.com') >= 0 || h.indexOf('fb.me') >= 0) return 'facebook';
    return null;
  }

  document.addEventListener('click', function (ev) {
    var node = ev.target;
    while (node && node.nodeName !== 'A') node = node.parentNode;
    if (!node || node.nodeName !== 'A') return;
    var name = nameFor(node.getAttribute('href') || '', node);
    if (name) track(name);
  }, true);

  hit();

  var last = location.pathname;
  function spa() { if (location.pathname !== last) { last = location.pathname; hit(); } }
  if (history.pushState) {
    var push = history.pushState;
    history.pushState = function () { push.apply(this, arguments); spa(); };
    window.addEventListener('popstate', spa);
  }
})();
