/* Vercel serverless: loguje odwiedziny bota AI (sygnal 2 — czy AI czyta strone).
   Wolane server-side z middleware na stronie klienta (nie z przegladarki).
   Body: { id, bot, path }.  Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  var d = req.body;
  if (typeof d === 'string') { try { d = JSON.parse(d); } catch (e) { d = null; } }
  if (!d || !d.id || !d.bot) return res.status(400).end();
  try {
    await fetch(process.env.SUPABASE_URL + '/rest/v1/stats_bot_hits', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': 'Bearer ' + process.env.SUPABASE_SERVICE_ROLE_KEY,
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        website_id: String(d.id),
        bot: String(d.bot).slice(0, 80),
        path: String(d.path || '/').slice(0, 512)
      })
    });
  } catch (e) {}
  return res.status(204).end();
}
