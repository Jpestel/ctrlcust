/**
 * Vercel Serverless Function — Stocke le JSON sur Vercel Blob et retourne l'URL
 * POST /api/share-json
 * Body: { jsonData, filename }
 */
const { put } = require('@vercel/blob')

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' })

  const { jsonData, filename } = req.body || {}
  if (!jsonData) return res.status(400).json({ error: 'Données JSON manquantes' })

  try {
    const blob = await put(filename || 'controle.json', jsonData, {
      access: 'public',
      contentType: 'application/json',
      addRandomSuffix: true,
    })

    return res.status(200).json({ url: blob.url })
  } catch (err) {
    return res.status(502).json({ error: `Erreur stockage : ${err.message}` })
  }
}
