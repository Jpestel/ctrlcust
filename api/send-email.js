/**
 * Vercel Serverless Function — Envoi du JSON de contrôle par mail via Resend
 * POST /api/send-email
 * Body: { to, subject, jsonData, filename }
 */
module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' })

  const { to, subject, jsonData, filename } = req.body || {}

  if (!jsonData) return res.status(400).json({ error: 'Données JSON manquantes' })

  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return res.status(502).json({ error: 'RESEND_API_KEY non configurée' })

  const recipient = to || 'jerompestel@gmail.com'
  const emailSubject = subject || 'Contrôle douanier — fichier JSON'
  const emailFilename = filename || 'controle.json'

  // Encoder le JSON en base64 pour la pièce jointe
  const base64Content = Buffer.from(jsonData).toString('base64')

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        from: 'ctrlcust <onboarding@resend.dev>',
        to: [recipient],
        subject: emailSubject,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #1e3a8a;">📋 ctrlcust — Contrôle douanier</h2>
            <p>Vous trouverez en pièce jointe le fichier JSON du contrôle douanier.</p>
            <p style="color: #6b7280; font-size: 0.9em;">Fichier : <strong>${emailFilename}</strong></p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 1.5rem 0;" />
            <p style="color: #9ca3af; font-size: 0.8em;">Envoyé automatiquement par ctrlcust</p>
          </div>
        `,
        attachments: [
          {
            filename: emailFilename,
            content: base64Content,
          }
        ],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      return res.status(502).json({ error: `Erreur Resend : ${err}` })
    }

    const data = await response.json()
    return res.status(200).json({ success: true, id: data.id })

  } catch (err) {
    return res.status(502).json({ error: `Erreur envoi mail : ${err.message}` })
  }
}
