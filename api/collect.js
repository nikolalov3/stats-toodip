/* Vercel serverless: odbiera wejscie (page view) lub zdarzenie-pieniadz i zapisuje do Supabase.
   Klasyfikuje zrodlo ruchu (AI / wyszukiwarka / social / direct) po referrerze.
   Unikalni: pierwszy-party identyfikator z przegladarki (vid) — stabilny miedzy
   dniami, bez PII; gdy go brak, fallback do dziennego hasha IP+UA.
   Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, (opc.) STATS_SALT */

import crypto from 'crypto';

/* Boty/crawlery/unfurlery nie sa ludzmi — nie licz ich jako odslon (sygnal 2,
   czyli AI CZYTA strone, ma osobny tor: /api/bot + stats_bot_hits). */
var BOT = /bot\b|crawler|spider|slurp|GPTBot|OAI-SearchBot|ChatGPT-User|PerplexityBot|Perplexity-User|ClaudeBot|Claude-Web|Anthropic|CCBot|Google-Extended|Googlebot|bingbot|Bytespider|Amazonbot|Applebot|facebookexternalhit|facebookcatalog|WhatsApp|TelegramBot|Slackbot|Discordbot|LinkedInBot|Twitterbot|SkypeUriPreview|Embedly|python-requests|node-fetch|axios|curl\/|wget|headlesschrome|phantomjs|puppeteer|playwright/i;

var AI = {
  'chatgpt.com': 'ChatGPT', 'chat.openai.com': 'ChatGPT',
  'perplexity.ai': 'Perplexity',
  'gemini.google.com': 'Gemini', 'bard.google.com': 'Gemini',
  'claude.ai': 'Claude',
  'copilot.microsoft.com': 'Copilot',
  'you.com': 'You.com', 'poe.com': 'Poe',
  'chatgpt.co': 'ChatGPT'
};

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch (e) { return ''; }
}

function classify(ref, params) {
  // wprost otagowane linki od asystentow
  var src = (params && (params.utm_source || params.ref) || '').toLowerCase();
  for (var key in AI) { if (src.indexOf(key.split('.')[0]) >= 0) return { source: 'ai', ai: AI[key] }; }

  if (!ref) return { source: 'direct', ai: null };
  var h = hostOf(ref);
  if (!h) return { source: 'other', ai: null };

  for (var k in AI) { if (h === k || h.endsWith('.' + k)) return { source: 'ai', ai: AI[k] }; }
  if (/(^|\.)(google|bing|duckduckgo|yahoo|yandex|ecosia|brave|baidu)\./.test(h)) return { source: 'search', ai: null };
  if (/(^|\.)(facebook|fb|instagram|t\.co|twitter|x\.com|tiktok|linkedin|reddit|pinterest|youtube|snapchat)\./.test(h)) return { source: 'social', ai: null };
  return { source: 'other', ai: null };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).end();

  var data = req.body;
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) { data = null; } }
  if (!data || !data.id) return res.status(400).end();

  var ua = req.headers['user-agent'] || '';
  var isEvent = !!data.e;

  /* Odrzuc boty/podglady (tylko odslony; zdarzenia-kliki przepuszczamy). 204,
     zeby beacon nie widzial bledu. */
  if (!isEvent && BOT.test(ua)) return res.status(204).end();

  /* Sciezka: tylko realny pathname zaczynajacy sie od "/". Renderery data:/blob:
     potrafia przyslac caly dokument jako "sciezke" — takie hity ignorujemy. */
  var path = String(data.p || '/').slice(0, 512);
  if (path.charAt(0) !== '/') return res.status(204).end();

  /* utm/ref z query (wysylane osobno jako q) — pozwala wykryc otagowane linki. */
  var params = {};
  try {
    new URLSearchParams(String(data.q || '').replace(/^\?/, '')).forEach(function (v, k) { params[k] = v; });
  } catch (e) {}

  var cls = isEvent ? { source: null, ai: null } : classify(data.r, params);

  var salt = process.env.STATS_SALT || 'toodip';
  var visitor;
  if (data.vid) {
    /* trwaly, pierwszy-party identyfikator z przegladarki: ta sama osoba na tym
       samym urzadzeniu = jeden unikalny, takze w kolejnych dniach. Bez IP. */
    visitor = crypto.createHash('sha256')
      .update(String(data.id) + '|v|' + String(data.vid).slice(0, 64) + '|' + salt)
      .digest('hex').slice(0, 24);
  } else {
    /* fallback bez localStorage: dzienny odcisk IP+UA (resetuje sie co dzien). */
    var ip = String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '').split(',')[0].trim();
    var day = new Date().toISOString().slice(0, 10);
    visitor = crypto.createHash('sha256')
      .update(String(data.id) + '|' + day + '|' + ip + '|' + ua + '|' + salt)
      .digest('hex').slice(0, 24);
  }

  var row = {
    website_id: String(data.id),
    path: path,
    referrer: String(data.r || '').slice(0, 512),
    title: data.t ? String(data.t).slice(0, 200) : null,
    lang: data.l ? String(data.l).slice(0, 10) : null,
    source: cls.source,
    ai_name: cls.ai,
    type: isEvent ? 'event' : 'pageview',
    name: isEvent ? String(data.e).slice(0, 40) : null,
    visitor: visitor,
    device: /Mobi|Android|iPhone|iPad|iPod/.test(ua) ? 'mobile' : 'desktop',
    country: req.headers['x-vercel-ip-country'] || null
  };

  try {
    await fetch(process.env.SUPABASE_URL + '/rest/v1/stats_events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(row)
    });
  } catch (e) {}
  return res.status(204).end();
}
