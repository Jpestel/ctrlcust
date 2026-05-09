import { useState } from 'react'
import JSZip from 'jszip'
import { formatDate } from '../utils'

function genVisiteConteneur(conteneur, ctrl, plombBL, date, isTerminal, heureFinControle, deuxAgents) {
  if (!ctrl) return ''
  let t = ''

  const moi = deuxAgents ? 'Nous' : 'Moi'
  const je = deuxAgents ? 'Nous' : 'Moi,'
  const fais = deuxAgents ? 'faisons' : 'fais'
  const demande = deuxAgents ? 'demandons' : 'demande'
  const constate = deuxAgents ? 'constatons' : 'constate'
  const prelevons = deuxAgents ? 'Nous ne prélevons' : 'Je ne prélève'

  const plombBLStr = (plombBL || '').trim().toUpperCase() || 'Non renseigné'
  const plombReel = (ctrl.plombReel || '').trim().toUpperCase() || 'Non renseigné'
  const commisNom = `${ctrl.commis.prenom} ${ctrl.commis.nom}`.trim() || '[Nom non renseigné]'
  const qualite = ctrl.commis.qualite === 'commis' ? 'commis' : 'coursier'

  t += `${'─'.repeat(52)}\n`
  t += `CONTENEUR N° ${conteneur.numero}\n`
  t += `${'─'.repeat(52)}\n\n`

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
    t += `${moi}, je ${fais} rompre le scellé commercial n° ${plombBLStr} par ${commisNom}, ouvrir le conteneur et aérer celui-ci.\n\n`
  }

  if (ctrl.descriptionChargement) {
    t += `DESCRIPTION DU CHARGEMENT :\n${ctrl.descriptionChargement}\n\n`
  }

  if (ctrl.cartons.length > 0) {
    t += `VÉRIFICATION DES MARCHANDISES :\n\n`
    ctrl.cartons.forEach((unite, i) => {
      const type = unite.type || 'carton'
      const typesConfig = {
        carton:  { label: 'Carton',              article: 'le',  labelMin: 'carton',  feminin: false },
        palette: { label: 'Palette',             article: 'la',  labelMin: 'palette', feminin: true  },
        sac:     { label: 'Sac',                 article: 'le',  labelMin: 'sac',     feminin: false },
        caisse:  { label: 'Caisse / Colis bois', article: 'la',  labelMin: 'caisse',  feminin: true  },
        vrac:    { label: 'Vrac',                article: null,  labelMin: 'vrac',    feminin: false },
        article: { label: 'Article',             article: "l'",  labelMin: 'article', feminin: false, isArticle: true },
        unite:   { label: 'Unité isolée',        article: "l'",  labelMin: 'unité',   feminin: true,  isArticle: true },
        autre:   { label: 'Unité',               article: "l'",  labelMin: 'unité',   feminin: true,  isArticle: true },
      }
      const cfg = typesConfig[type] || typesConfig.autre
      const isVrac = type === 'vrac'
      const isArticle = cfg.isArticle === true

      if (isVrac) {
        t += `Marchandise en vrac (unité n°${i + 1}) :\n`
        if (unite.descriptionMentions) t += `${unite.descriptionMentions}\n`
        t += `\n`
      } else if (isArticle) {
        t += `${cfg.label} n°${i + 1}${unite.reference ? ` — Référence : ${unite.reference}` : ''}\n`
        if (unite.descriptionMentions) t += `${unite.descriptionMentions}\n`
        t += `${moi}, je ${demande} au ${qualite} de remettre ${cfg.article}${cfg.labelMin} dans le conteneur.\n\n`
      } else {
        t += `${cfg.label} n°${i + 1}${unite.reference ? ` — Référence : ${unite.reference}` : ''}\n`
        if (unite.descriptionMentions) t += `${unite.descriptionMentions}\n`
        if (unite.mentionFermeture === 'complet') {
          t += `${moi}, je ${fais} refermer ${cfg.article} ${cfg.labelMin} et apposer dessus les mentions "Visite douane" et la date ${date}.\n\n`
        } else if (unite.mentionFermeture === 'libre' && unite.mentionLibre) {
          t += `${moi}, je ${fais} refermer ${cfg.article} ${cfg.labelMin} et apposer la mention : "${unite.mentionLibre}".\n\n`
        } else if (unite.mentionFermeture === 'prelevement_examen') {
          const detail = unite.detailPrelevementExamen ? ` (${unite.detailPrelevementExamen})` : ''
          t += `Un prélèvement pour examen a été effectué${detail}. ${moi}, je ${fais} refermer ${cfg.article} ${cfg.labelMin} avec mention du prélèvement. Les articles prélevés seront restitués au RDE après examen.\n\n`
        }
      }
    })
  }

  // Prélèvements labo
  if (ctrl.hasPrelevementsLabo && ctrl.prelevementsLabo.length > 0) {
    t += `PRÉLÈVEMENTS POUR ANALYSE LABORATOIRE :\n\n`
    ctrl.prelevementsLabo.forEach((p, i) => {
      const destMap = { emporte: "emporté par l'agent", entrepot: 'laissé en entrepôt' }
      const modePrelev = p.modePrelev || 'sachets'
      t += `Prélèvement n°${i + 1} :\n`
      t += `  Référence       : ${p.reference || 'Non renseignée'}\n`
      t += `  Quantité        : ${p.quantite || 'Non renseignée'}\n`
      t += `  Mode            : ${modePrelev === 'sachets' ? 'Sachets à sceller' : 'Pince à sceller et ficelle résistante'}\n`
      t += `  Scellé douanier : ${p.numeroScelle || 'Non renseigné'}\n`
      if (modePrelev === 'sachets') {
        t += `  Sachets :\n`
        t += `    • Sachet n°1 (douane) : ${destMap[p.sachet1]}\n`
        t += `    • Sachet n°2 (douane) : ${destMap[p.sachet2]}\n`
        t += `    • Sachet n°3 (douane) : ${destMap[p.sachet3]}\n`
        t += `    • Sachet n°4 (RDE)    : remis à ${commisNom} pour le compte du déclarant en douane\n\n`
      } else {
        t += `  Le prélèvement a été effectué à l'aide d'une pince à sceller et de ficelle résistante, scellé n° ${p.numeroScelle || 'Non renseigné'}.\n\n`
      }
    })
  } else {
    t += `${prelevons} aucun échantillon.\n\n`
  }

  if (isTerminal && ctrl.nouveauPlomb) {
    const fin = heureFinControle ? heureFinControle.replace(':', 'h') : '__h__'
    t += `${moi}, je ${fais} refermer le conteneur et apposer un nouveau plomb commercial n° ${ctrl.nouveauPlomb} reconnu intègre. Fin des opérations de visite à ${fin}.\n\n`
  }

  return t
}

function resolveLieu(value) {
  const LIEUX_MAP = {
    'TDF': 'Terminal De France - Aire de visite PELICAN',
    'MTL': 'MTL',
  }
  return LIEUX_MAP[value] || value || 'Non renseigné'
}

function resolveGrade(value, libre) {
  const map = {
    agent_constatation: 'agent de constatation des douanes',
    controleur_2: 'contrôleur de 2ème classe des douanes',
    controleur_1: 'contrôleur de 1ère classe des douanes',
    inspecteur: 'inspecteur des douanes',
    inspecteur_principal: 'inspecteur principal des douanes',
    libre: libre || '',
  }
  return map[value] || value || 'contrôleur des douanes'
}

function genFonctionCommis(ctrl, importateurStr, representantStr) {
  const prenom = ctrl?.commis?.prenom || ''
  const nom = ctrl?.commis?.nom || ''
  const nomComplet = `${prenom} ${nom}`.trim() || '[Commis]'
  const qualite = ctrl?.commis?.qualite || 'commis'
  const rep = representantStr && representantStr !== 'Case vide' ? representantStr : importateurStr

  if (qualite === 'coursier') {
    return `${nomComplet}, coursier mandaté par la société ${rep} pour effectuer en son nom les opérations de visite pour le compte de l'importateur ${importateurStr}`
  }
  return `${nomComplet}, commis en douane de la société ${rep}, effectuant les opérations de visite pour le compte de l'importateur ${importateurStr}`
}

function generateTexte(data) {
  const {
    flux, nomAgent, civiliteAgent, gradeAgent, gradeAgentLibre,
    hasSecondAgent, nomAgent2, civiliteAgent2, gradeAgent2, gradeAgent2Libre,
    numeroDeclaration,
    dateControle, heureControle, heureFinControle, lieuControle, lieuControleLibre,
    dateControleDepot, heureControleDepot, lieuControleDepot,
    conteneurs, plombsBL, controles, controlesDepot,
    hasVisiteDepot, importateur, representant,
    docDeclaration,
  } = data

  const isTerminal = lieuControle !== 'libre'
  const lieu1 = lieuControle === 'libre' ? (lieuControleLibre || 'Non renseigné') : resolveLieu(lieuControle)
  const lieu1Court = lieuControle === 'libre' ? (lieuControleLibre || '') : lieuControle
  const date1 = formatDate(dateControle) || '__/__/____'
  const heure1 = heureControle ? heureControle.replace(':', 'h') : '__h__'
  const heureFin = heureFinControle ? heureFinControle.replace(':', 'h') : null
  const date2 = formatDate(dateControleDepot) || '__/__/____'
  const heure2 = heureControleDepot ? heureControleDepot.replace(':', 'h') : '__h__'
  const lieu2 = lieuControleDepot ? resolveLieu(lieuControleDepot) : 'Non renseigné'

  const crn = docDeclaration?.data?.crn || numeroDeclaration || '[N° de déclaration]'
  const fluxLabel = flux === 'import' ? "d'importation" : "d'exportation"
  const importateurStr = importateur || '[Importateur]'
  const representantStr = representant && representant !== 'Case vide' ? representant : importateurStr

  // Identité agent(s)
  const civ1 = civiliteAgent || 'M.'
  const agent1Nom = nomAgent || '[Prénom NOM]'
  const grade1 = resolveGrade(gradeAgent, gradeAgentLibre)
  const deuxAgents = hasSecondAgent && nomAgent2
  const civ2 = civiliteAgent2 || 'M.'
  const agent2Nom = nomAgent2 || ''
  const grade2 = resolveGrade(gradeAgent2, gradeAgent2Libre)

  const sujet = deuxAgents ? 'Nous' : 'Moi'
  const moi = deuxAgents ? 'nous' : 'me'
  const rendons = deuxAgents ? 'rendons' : 'rends'
  const porteur = deuxAgents ? "porteurs de nos commissions d'emploi" : "porteur de ma commission d'emploi"
  const munis = deuxAgents ? 'munis de nos équipements de protection individuelle' : 'muni de mes équipements de protection individuelle'
  const revetu = deuxAgents ? 'revêtus' : 'revêtu'

  let identiteAgents = ''
  if (deuxAgents) {
    if (grade1 === grade2) {
      identiteAgents = `${sujet}, ${civ1} ${agent1Nom} et ${civ2} ${agent2Nom}, tous deux ${grade1} du Havre secteur OCEAN`
    } else {
      identiteAgents = `${sujet}, ${civ1} ${agent1Nom} et ${civ2} ${agent2Nom}, respectivement ${grade1} et ${grade2} du Havre secteur OCEAN`
    }
  } else {
    identiteAgents = `${sujet}, ${civ1} ${agent1Nom}, ${grade1} du Havre secteur OCEAN`
  }

  const premierCtrl = controles?.[0]
  const nomCommis = `${premierCtrl?.commis?.prenom || ''} ${premierCtrl?.commis?.nom || ''}`.trim()

  let t = ''
  t += `DÉROULEMENT DU CONTRÔLE PHYSIQUE\n`
  t += `${'='.repeat(52)}\n\n`
  t += `Personne présente au contrôle : ${nomCommis || '[Non renseigné]'}\n`
  t += `Fonction                       : ${genFonctionCommis(premierCtrl, importateurStr, representantStr)}\n\n`
  t += `Date et heure de début : ${date1} à ${heure1}\n`
  if (heureFin) t += `Date et heure de fin   : ${date1} à ${heureFin}\n`
  t += `Déclaration            : ${crn}\n\n`

  const nouveauxScelles = (conteneurs || [])
    .map(c => controles?.find(ct => ct.conteneurId === c.id)?.nouveauPlomb)
    .filter(Boolean)
  if (nouveauxScelles.length > 0) {
    t += `Nouveau(x) numéro(s) de scellé : ${nouveauxScelles.join(' / ')}\n\n`
  }

  t += `${'─'.repeat(52)}\n`
  t += `DESCRIPTION ET INSPECTION DES MARCHANDISES\n`
  t += `${'─'.repeat(52)}\n\n`

  t += `Le ${date1} à ${heure1}, ${identiteAgents}, ${deuxAgents ? 'nous rendons' : 'me rends'} en fonction de visite, ${porteur}, en tenue civile ${revetu} de la chasuble sérigraphiée "Douane" et ${munis}, sur le lieu de contrôle situé à ${lieu1Court || lieu1} afin de procéder au contrôle des marchandises dédouanées sur la déclaration ${fluxLabel} n° ${crn}.\n\n`
  t += `Les opérations de visite se déroulent en présence constante et effective de ${nomCommis || '[Commis/Coursier]'}.\n\n`

  for (const conteneur of conteneurs || []) {
    const ctrl = controles?.find(c => c.conteneurId === conteneur.id)
    t += genVisiteConteneur(conteneur, ctrl, plombsBL?.[conteneur.id], date1, isTerminal, heureFinControle, deuxAgents)
  }

  if (isTerminal && hasVisiteDepot && (controlesDepot || []).length > 0) {
    t += `${'═'.repeat(52)}\n`
    t += `VISITE 2 — DÉPOTAGE — ${lieu2} — ${date2} à ${heure2}\n`
    t += `${'═'.repeat(52)}\n\n`
    t += `Suite au contrôle au terminal ${lieu1Court} du ${date1}, la marchandise a fait l'objet d'un dépotage en magasin. Une seconde visite physique a été effectuée.\n\n`
    for (const conteneur of conteneurs || []) {
      const ctrl = (controlesDepot || []).find(c => c.conteneurId === conteneur.id)
      t += genVisiteConteneur(conteneur, ctrl, null, date2, false, null, deuxAgents)
    }
  }

  t += `${'='.repeat(52)}\n`
  t += `Fait au Havre, le ${date1}.\n`
  if (nomAgent) t += `\n${civ1} ${agent1Nom}`
  if (deuxAgents) t += `\n${civ2} ${agent2Nom}`

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

  function handleGenerateJSON() {
    const crn = data.docDeclaration?.data?.crn || data.numeroDeclaration || 'controle'
    const date = data.dateControle || new Date().toISOString().slice(0, 10)
    const filename = `controle-${crn}-${date}.json`
    const json = JSON.stringify(data, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)

    // Proposer téléchargement
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)

    // Proposer envoi par mail
    const subject = encodeURIComponent(`Contrôle douanier — ${crn} — ${date}`)
    const body = encodeURIComponent(`Bonjour,\n\nVeuillez trouver ci-joint le fichier JSON du contrôle douanier ${crn} effectué le ${date}.\n\nCordialement`)
    window.open(`mailto:?subject=${subject}&body=${body}`)
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
          <button className="btn btn-secondary" onClick={handleGenerateJSON}>📤 Générer JSON &amp; envoyer par mail</button>
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
