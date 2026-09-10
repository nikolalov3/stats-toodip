/* Vercel serverless: odbiera wejscie (page view) lub zdarzenie-pieniadz i zapisuje do Supabase.
   Klasyfikuje zrodlo ruchu (AI / wyszukiwarka / social / direct) po referrerze.
   Unikalni: cookieless dzienny hash (IP+UA+dzien+strona) — nieodwracalny, bez PII.
   Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, (opc.) STATS_SALT */

import crypto from 'crypto';

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

  var path = String(data.p || '/').slice(0, 512);
  var params = {};
  try { new URL('http://x' + path).searchParams.forEach(function (v, k) { params[k] = v; }); } catch (e) {}

  var ua = req.headers['user-agent'] || '';
  var isEvent = !!data.e;
  var cls = isEvent ? { source: null, ai: null } : classify(data.r, params);

  /* cookieless dzienny odcisk: IP + UA + dzien + strona -> hash (bez zapisu IP) */
  var ip = String(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '').split(',')[0].trim();
  var day = new Date().toISOString().slice(0, 10);
  var salt = process.env.STATS_SALT || 'toodip';
  var visitor = crypto.createHash('sha256')
    .update(String(data.id) + '|' + day + '|' + ip + '|' + ua + '|' + salt)
    .digest('hex').slice(0, 24);

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
