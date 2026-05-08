/**
 * Vercel Serverless Function — Génère des conseils de contrôle physique
 * via l'API Anthropic Claude, basés sur le code SH et la nomenclature NC.
 *
 * POST /api/controle-conseils
 * Body: { code, labelNC, designationCommerciale }
 */
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' })

  const { code, labelNC, designationCommerciale } = req.body || {}

  if (!code || !labelNC) {
    return res.status(400).json({ error: 'Paramètres code et labelNC requis' })
  }

  const prompt = `Tu es un expert en contrôle douanier physique des marchandises pour la douane française (DGDDI).

Une déclaration en douane mentionne l'article suivant :
- Code SH/NC : ${code}
- Nomenclature combinée officielle : ${labelNC}
- Désignation commerciale déclarée : ${designationCommerciale || 'non précisée'}

En tant qu'agent des douanes effectuant un contrôle physique, liste entre 4 et 6 points de vérification concrets et spécifiques à ce type de marchandise.

Ces points doivent porter sur :
- La conformité physique (aspect, marquages, étiquetages)
- Les risques de fraude spécifiques à ce type de produit
- Les éléments de concordance avec la déclaration (poids, quantité, conditionnement)
- Les réglementations particulières (normes, restrictions, licences éventuelles)

Réponds UNIQUEMENT avec un objet JSON valide, sans texte avant ni après, sans balises markdown :
{
  "conseils": [
    "Point de contrôle 1",
    "Point de contrôle 2",
    "Point de contrôle 3",
    "Point de contrôle 4"
  ]
}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1000,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return res.status(502).json({ error: `Erreur API Claude : ${err}` })
    }

    const data = await response.json()
    const text = data.content?.map(b => b.text || '').join('') || ''

    // Parser le JSON retourné par Claude
    const clean = text.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(clean)

    return res.status(200).json({ code, conseils: parsed.conseils || [] })

  } catch (err) {
    return res.status(502).json({ error: `Erreur génération conseils : ${err.message}` })
  }
}
