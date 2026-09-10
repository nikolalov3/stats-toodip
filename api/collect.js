/* Vercel serverless function: odbiera beacon o wejsciu i zapisuje go w Supabase.
   Uzywa SERVICE ROLE key (server-side, sekret w env) -> omija RLS przy zapisie.
   Env potrzebne: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).end();

  var data = req.body;
  if (typeof data === 'string') { try { data = JSON.parse(data); } catch (e) { data = null; } }
  if (!data || !data.id) return res.status(400).end();

  var row = {
    website_id: String(data.id),
    path: String(data.p || '/').slice(0, 512),
    referrer: String(data.r || '').slice(0, 512),
    country: req.headers['x-vercel-ip-country'] || null
  };

  try {
    var r = await fetch(process.env.SUPABASE_URL + '/rest/v1/events', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify(row)
    });
    // 201/204 = ok; nieznany website_id lamie FK -> 4xx (odrzucamy po cichu)
    return res.status(r.ok ? 204 : 204).end();
  } catch (e) {
    return res.status(204).end();
  }
}
