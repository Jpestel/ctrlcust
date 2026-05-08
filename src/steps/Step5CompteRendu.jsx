import { useState } from 'react'
import JSZip from 'jszip'
import { formatDate } from '../utils'

function genVisiteConteneur(conteneur, ctrl, plombBL, date, isTerminal) {
  if (!ctrl) return ''
  let t = ''

  const plombBLStr = (plombBL || '').trim().toUpperCase() || 'Non renseigné'
  const plombReel = (ctrl.plombReel || '').trim().toUpperCase() || 'Non renseigné'
  const commisNom = `${ctrl.commis.prenom} ${ctrl.commis.nom}`.trim() || '[Nom non renseigné]'
  const qualite = ctrl.commis.qualite === 'commis' ? 'commis en douane' : 'coursier'

  t += `${'─'.repeat(52)}\n`
  t += `CONTENEUR N° ${conteneur.numero}\n`
  t += `${'─'.repeat(52)}\n\n`

  t += `La visite s'est déroulée en présence de ${commisNom}, ${qualite}.\n\n`

  if (isTerminal) {
    t += `VÉRIFICATION DU PLOMB :\n`
    t += `  Plomb mentionné sur le BL      : ${plombBLStr}\n`
    t += `  Plomb constaté sur le conteneur : ${plombReel}\n`
    const comparables = plombBLStr !== 'Non renseigné' && plombReel !== 'Non renseigné'
    if (comparables) {
      t += plombBLStr === plombReel
        ? `  → Les numéros de plombs sont concordants.\n\n`
        : `  → DISCORDANCE CONSTATÉE entre le numéro de plomb figurant sur le Bill of Lading (${plombBLStr}) et le numéro de plomb apposé sur le conteneur (${plombReel}).\n\n`
    } else {
      t += `\n`
    }
    t += `Après rupture du plomb par ${commisNom} et ouverture des portes du conteneur, un temps d'aération suffisant a été respecté avant d'approcher les marchandises.\n\n`
  }

  if (ctrl.descriptionChargement) {
    t += `DESCRIPTION DU CHARGEMENT :\n${ctrl.descriptionChargement}\n\n`
  }

  if (ctrl.cartons.length > 0) {
    t += `VÉRIFICATION DES MARCHANDISES :\n\n`
    ctrl.cartons.forEach((carton, i) => {
      t += `Carton n°${i + 1} — Référence : ${carton.reference || 'Non renseignée'}\n`
      if (carton.descriptionMentions) t += `${carton.descriptionMentions}\n`
      if (carton.mentionFermeture === 'complet') {
        t += `Après ouverture et vérification du contenu, le carton a été refermé. Mention apposée : "Visite douane — ${date} — Complet".\n\n`
      } else {
        const detail = carton.detailPrelevementExamen ? ` (${carton.detailPrelevementExamen})` : ''
        t += `Après ouverture et vérification, un prélèvement pour examen a été effectué${detail}. Le carton a été refermé avec mention du prélèvement. Les articles prélevés seront restitués au RDE après examen.\n\n`
      }
    })
  }

  if (ctrl.hasPrelevementsLabo && ctrl.prelevementsLabo.length > 0) {
    t += `PRÉLÈVEMENTS POUR ANALYSE LABORATOIRE :\n\n`
    ctrl.prelevementsLabo.forEach((p, i) => {
      const destMap = { emporte: "emporté par l'agent", entrepot: 'laissé en entrepôt' }
      t += `Prélèvement n°${i + 1} :\n`
      t += `  Référence       : ${p.reference || 'Non renseignée'}\n`
      t += `  Quantité        : ${p.quantite || 'Non renseignée'}\n`
      t += `  Scellé douanier : ${p.numeroScelle || 'Non renseigné'}\n`
      t += `  Sachets :\n`
      t += `    • Sachet n°1 (douane) : ${destMap[p.sachet1]}\n`
      t += `    • Sachet n°2 (douane) : ${destMap[p.sachet2]}\n`
      t += `    • Sachet n°3 (douane) : ${destMap[p.sachet3]}\n`
      t += `    • Sachet n°4 (RDE)    : remis à ${commisNom} pour le compte du déclarant en douane\n\n`
    })
  }

  if (isTerminal && ctrl.nouveauPlomb) {
    t += `FERMETURE DU CONTENEUR :\n`
    t += `Un nouveau plomb a été apposé par ${commisNom}. Numéro du nouveau scellé : ${ctrl.nouveauPlomb}.\n\n`
  }

  return t
}

function generateTexte(data) {
  const {
    flux, nomAgent, numeroDeclaration,
    dateControle, heureControle, lieuControle, lieuControleLibre,
    dateControleDepot, heureControleDepot, lieuControleDepot,
    conteneurs, plombsBL, controles, controlesDepot,
    hasVisiteDepot, importateur, representant,
  } = data

  const isTerminal = lieuControle !== 'libre'
  const lieu1 = lieuControle === 'libre' ? lieuControleLibre : lieuControle
  const date1 = formatDate(dateControle) || '__/__/____'
  const heure1 = heureControle || '__:__'
  const date2 = formatDate(dateControleDepot) || '__/__/____'
  const heure2 = heureControleDepot || '__:__'
  const lieu2 = lieuControleDepot || 'Non renseigné'
  const agent = nomAgent || '[Nom de l\'agent]'
  const decl = numeroDeclaration || '[N° de déclaration]'
  const fluxLabel = flux === 'import' ? "d'importation" : "d'exportation"
  const importateurStr = importateur || '[Importateur]'
  const representantStr = representant || '[Représentant en douane]'

  let t = ''
  t += `COMPTE RENDU DE VISITE PHYSIQUE\n`
  t += `${'='.repeat(52)}\n\n`
  t += `Nature        : Contrôle physique à l'${flux.toUpperCase()}\n`
  t += `Déclaration   : ${decl}\n`
  t += `Importateur   : ${importateurStr}\n`
  t += `Représentant  : ${representantStr}\n`
  t += `Agent         : ${agent}\n\n`

  const nbVisites = isTerminal && hasVisiteDepot ? 2 : 1
  if (nbVisites === 2) {
    t += `Ce contrôle comporte deux visites physiques :\n`
    t += `  • Visite 1 — Terminal ${lieu1} — le ${date1} à ${heure1}\n`
    t += `  • Visite 2 — Magasin (dépotage) — ${lieu2} — le ${date2} à ${heure2}\n\n`
  } else {
    t += `Date          : ${date1} à ${heure1}\n`
    t += `Lieu          : ${lieu1 || 'Non renseigné'}\n\n`
  }

  t += `Je soussigné(e), ${agent}, contrôleur des douanes affecté(e) au bureau du Havre Port, certifie avoir procédé au contrôle physique des marchandises faisant l'objet de la déclaration ${fluxLabel} n° ${decl}, déposée pour le compte de ${importateurStr} par ${representantStr}.\n\n`

  // ── VISITE 1 (terminal ou dépotage seul) ──
  if (nbVisites === 2) {
    t += `${'═'.repeat(52)}\n`
    t += `VISITE 1 — TERMINAL ${lieu1} — ${date1} à ${heure1}\n`
    t += `${'═'.repeat(52)}\n\n`
  }

  for (const conteneur of conteneurs) {
    const ctrl = controles.find(c => c.conteneurId === conteneur.id)
    t += genVisiteConteneur(conteneur, ctrl, plombsBL[conteneur.id], date1, isTerminal)
  }

  // ── VISITE 2 (dépotage, si applicable) ──
  if (isTerminal && hasVisiteDepot && (controlesDepot || []).length > 0) {
    t += `${'═'.repeat(52)}\n`
    t += `VISITE 2 — MAGASIN (DÉPOTAGE) — ${lieu2} — ${date2} à ${heure2}\n`
    t += `${'═'.repeat(52)}\n\n`
    t += `Suite au contrôle au terminal ${lieu1} du ${date1}, la marchandise a fait l'objet d'un dépotage. Une seconde visite physique a été effectuée au magasin.\n\n`

    for (const conteneur of conteneurs) {
      const ctrl = (controlesDepot || []).find(c => c.conteneurId === conteneur.id)
      t += genVisiteConteneur(conteneur, ctrl, null, date2, false)
    }
  }

  t += `${'='.repeat(52)}\n`
  t += `Fait au Havre, le ${date1}.\n`
  if (nomAgent) t += `\n${nomAgent}`

  return t
}

export default function Step5CompteRendu({ data }) {
  const [copied, setCopied] = useState(false)
  const [zipping, setZipping] = useState(false)

  const texte = generateTexte(data)

  function handleCopy() {
    navigator.clipboard.writeText(texte).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  async function handleDownloadPhotos() {
    if (data.photos.length === 0) return
    setZipping(true)
    try {
      const zip = new JSZip()
      for (const photo of data.photos) {
        const arrayBuffer = await photo.blob.arrayBuffer()
        zip.file(`${photo.name}.${photo.extension}`, arrayBuffer)
      }
      const blob = await zip.generateAsync({ type: 'blob' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `photos-controle-${data.numeroDeclaration || 'douane'}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      alert('Erreur lors de la création du ZIP : ' + err.message)
    }
    setZipping(false)
  }

  return (
    <>
      <div className="card">
        <div className="card-title">Compte rendu de contrôle</div>
        <div className="compte-rendu-box">{texte}</div>
        <div style={{ display: 'flex', alignItems: 'center', marginTop: '0.85rem', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={handleCopy}>Copier le texte</button>
          {copied && <span className="copy-feedback">✓ Copié dans le presse-papier !</span>}
        </div>
      </div>

      {data.photos.length > 0 && (
        <div className="card">
          <div className="card-title">Photos ({data.photos.length})</div>
          <div className="alert alert-info">
            Téléchargez vos photos en ZIP pour les joindre à votre compte rendu dans l'applicatif douanier.
          </div>
          <button className="btn btn-success" onClick={handleDownloadPhotos} disabled={zipping}>
            {zipping ? 'Création du ZIP...' : `↓ Télécharger les ${data.photos.length} photos (ZIP)`}
          </button>
        </div>
      )}
    </>
  )
}
