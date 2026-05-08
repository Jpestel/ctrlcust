/**
 * Vercel Serverless Function — Proxy vers tarifdouanier.eu
 * Route : /api/hs-lookup?code=4011100000
 *
 * Contourne le CORS de tarifdouanier.eu en faisant la requête côté serveur.
 */
module.exports = async function handler(req, res) {
  // CORS : autorise les appels depuis n'importe quelle origine (notre front Vercel)
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  const { code } = req.query

  if (!code || !/^\d{8,10}$/.test(code)) {
    return res.status(400).json({ error: 'Paramètre code invalide (8 à 10 chiffres requis)' })
  }

  const code8 = code.slice(0, 8)
  const url = `https://www.tarifdouanier.eu/api/v1/cnSuggest?term=${code8}&lang=fr&year=2026`

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'ctrlcust-douane/1.0',
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      return res.status(502).json({ error: `Erreur tarifdouanier.eu : HTTP ${response.status}` })
    }

    const data = await response.json()

    // La réponse est { suggestions: [{ code, value, data }] }
    // value contient du HTML : "<span><em>40111000</em></span> Pneumatiques neufs..."
    const suggestions = data?.suggestions
    if (Array.isArray(suggestions) && suggestions.length > 0) {
      const raw = suggestions[0].value || ''
      // Nettoyer les balises HTML
      const label = raw.replace(/<[^>]+>/g, '').trim()
      return res.status(200).json({ code, label: label || null })
    }

    return res.status(200).json({ code, label: null })

  } catch (err) {
    return res.status(502).json({ error: `Erreur proxy : ${err.message}` })
  }
}
