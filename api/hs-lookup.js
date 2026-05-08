/**
 * Vercel Serverless Function — Proxy vers tarifdouanier.eu
 * Route : /api/hs-lookup?code=4011100000
 *
 * Contourne le CORS de tarifdouanier.eu en faisant la requête côté serveur.
 */
export default async function handler(req, res) {
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

    // Cherche la meilleure correspondance pour le code fourni
    const prefix6 = code8.slice(0, 6)
    const match = Array.isArray(data)
      ? data.find(item => item.id && item.id.replace(/\s/g, '').startsWith(prefix6))
      : null

    if (match?.label) {
      return res.status(200).json({ code, label: match.label })
    }

    // Pas de correspondance exacte → renvoie le premier résultat si disponible
    if (Array.isArray(data) && data.length > 0 && data[0].label) {
      return res.status(200).json({ code, label: data[0].label })
    }

    return res.status(200).json({ code, label: null })

  } catch (err) {
    return res.status(502).json({ error: `Erreur proxy : ${err.message}` })
  }
}
