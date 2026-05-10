/**
 * POST /api/verify-pin
 * Body: { hash }
 * Returns: { role: 'master' | 'user' | null }
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' })

  const { hash } = req.body || {}
  if (!hash) return res.status(400).json({ error: 'Hash manquant' })

  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN

  if (!url || !token) return res.status(502).json({ error: 'Redis non configuré' })

  try {
    // Vérifier PIN maître
    const masterRes = await fetch(`${url}/get/ctrlcust:master`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const masterData = await masterRes.json()
    if (masterData.result === hash) {
      return res.status(200).json({ role: 'master' })
    }

    // Vérifier PINs utilisateurs
    const usersRes = await fetch(`${url}/get/ctrlcust:users`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    const usersData = await usersRes.json()
    const users = usersData.result ? JSON.parse(usersData.result) : []

    if (users.some(u => u.hash === hash)) {
      return res.status(200).json({ role: 'user' })
    }

    return res.status(200).json({ role: null })
  } catch (err) {
    return res.status(502).json({ error: err.message })
  }
}
