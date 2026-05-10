/**
 * POST /api/manage-pins
 * Body: { masterHash, action, payload }
 * Actions: 'init' | 'set-master' | 'add-user' | 'remove-user' | 'list-users'
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' })

  const { masterHash, action, payload } = req.body || {}
  const url = process.env.KV_REST_API_URL
  const token = process.env.KV_REST_API_TOKEN

  if (!url || !token) return res.status(502).json({ error: 'Redis non configuré' })

  async function redisGet(key) {
    const r = await fetch(`${url}/get/${key}`, { headers: { Authorization: `Bearer ${token}` } })
    const d = await r.json()
    return d.result
  }

  async function redisSet(key, value) {
    await fetch(`${url}/set/${key}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify([key, typeof value === 'string' ? value : JSON.stringify(value)])
    })
  }

  async function redisSetSimple(key, value) {
    const val = typeof value === 'string' ? value : JSON.stringify(value)
    await fetch(`${url}/set/${encodeURIComponent(key)}/${encodeURIComponent(val)}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
  }

  try {
    // Action init — initialise le PIN maître si absent
    if (action === 'init') {
      const existing = await redisGet('ctrlcust:master')
      if (!existing && payload?.hash) {
        await redisSetSimple('ctrlcust:master', payload.hash)
      }
      return res.status(200).json({ ok: true })
    }

    // Toutes les autres actions nécessitent le hash maître
    const currentMaster = await redisGet('ctrlcust:master')
    if (!currentMaster || masterHash !== currentMaster) {
      return res.status(403).json({ error: 'Non autorisé' })
    }

    if (action === 'set-master') {
      await redisSetSimple('ctrlcust:master', payload.hash)
      return res.status(200).json({ ok: true })
    }

    if (action === 'list-users') {
      const raw = await redisGet('ctrlcust:users')
      const users = raw ? JSON.parse(raw) : []
      return res.status(200).json({ users })
    }

    if (action === 'add-user') {
      const raw = await redisGet('ctrlcust:users')
      const users = raw ? JSON.parse(raw) : []
      if (users.some(u => u.hash === payload.hash)) {
        return res.status(400).json({ error: 'Ce PIN existe déjà' })
      }
      if (payload.hash === currentMaster) {
        return res.status(400).json({ error: 'Ce PIN est celui du maître' })
      }
      users.push({ id: Date.now(), label: payload.label, hash: payload.hash })
      await redisSetSimple('ctrlcust:users', JSON.stringify(users))
      return res.status(200).json({ ok: true, users })
    }

    if (action === 'remove-user') {
      const raw = await redisGet('ctrlcust:users')
      const users = raw ? JSON.parse(raw) : []
      const filtered = users.filter(u => u.id !== payload.id)
      await redisSetSimple('ctrlcust:users', JSON.stringify(filtered))
      return res.status(200).json({ ok: true, users: filtered })
    }

    return res.status(400).json({ error: 'Action inconnue' })
  } catch (err) {
    return res.status(502).json({ error: err.message })
  }
}
