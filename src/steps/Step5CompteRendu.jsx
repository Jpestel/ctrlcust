import { useState } from 'react'
import JSZip from 'jszip'
import { formatDate } from '../utils'

function genVisiteConteneur(conteneur, ctrl, plombBL, date, isTerminal, heureFinControle, deuxAgents, lieu) {
  if (!ctrl) return ''
  let t = ''

  const je = deuxAgents ? 'Nous' : 'Je'
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
    t += `${je} ${fais} rompre le scellé commercial n° ${plombBLStr} par ${commisNom}, ouvrir le conteneur et aérer celui-ci.\n\n`
  }

  if (ctrl.descriptionChargement) {
    t += `DESCRIPTION DU CHARGEMENT :\n${ctrl.descriptionChargement}\n\n`
  }

  if (ctrl.cartons.length > 0) {
    t += `VÉRIFICATION DES MARCHANDISES :\n\n`
    const nbUnites = ctrl.cartons.length

    // Ordinaux français
    const ordinaux = ['premier', 'second', 'troisième', 'quatrième', 'cinquième', 'sixième', 'septième', 'huitième', 'neuvième', 'dixième']
    const ordinauxF = ['première', 'seconde', 'troisième', 'quatrième', 'cinquième', 'sixième', 'septième', 'huitième', 'neuvième', 'dixième']

    ctrl.cartons.forEach((unite, i) => {
      const type = unite.type || 'carton'
      const typesConfig = {
        carton:  { label: 'Carton',              article: 'le',  articleIndef: 'un',  labelMin: 'carton',  feminin: false },
        palette: { label: 'Palette',             article: 'la',  articleIndef: 'une', labelMin: 'palette', feminin: true  },
        sac:     { label: 'Sac',                 article: 'le',  articleIndef: 'un',  labelMin: 'sac',     feminin: false },
        caisse:  { label: 'Caisse / Colis bois', article: 'la',  articleIndef: 'une', labelMin: 'caisse',  feminin: true  },
        vrac:    { label: 'Vrac',                article: null,  articleIndef: null,  labelMin: 'vrac',    feminin: false },
        article: { label: 'Article',             article: "l'",  articleIndef: 'un',  labelMin: 'article', feminin: false, isArticle: true },
        unite:   { label: 'Unité isolée',        article: "l'",  articleIndef: 'une', labelMin: 'unité',   feminin: true,  isArticle: true },
        autre:   { label: 'Unité',               article: "l'",  articleIndef: 'une', labelMin: 'unité',   feminin: true,  isArticle: true },
      }
      const cfg = typesConfig[type] || typesConfig.autre
      const isVrac = type === 'vrac'
      const isArticle = cfg.isArticle === true

      // Ordinal accordé en genre
      const ordinal = cfg.feminin
        ? (ordinauxF[i] || `${i + 1}ème`)
        : (ordinaux[i] || `${i + 1}ème`)

      if (isVrac) {
        if (nbUnites > 1) t += `${je} ${demande} au ${qualite} ${cfg.articleIndef} ${ordinal} lot en vrac${unite.reference ? ` portant la réf. ${unite.reference}` : ''}.\n`
        if (unite.descriptionMentions) t += `${unite.descriptionMentions}\n`
        t += `\n`

      } else if (isArticle) {
        if (nbUnites > 1) {
          t += `${je} ${demande} au ${qualite} ${cfg.articleIndef} ${ordinal} ${cfg.labelMin}${unite.reference ? ` portant la réf. ${unite.reference}` : ''}.\n`
        } else if (unite.reference) {
          t += `${je} ${demande} au ${qualite} ${cfg.articleIndef} ${cfg.labelMin} portant la réf. ${unite.reference}.\n`
        }
        if (unite.descriptionMentions) t += `${unite.descriptionMentions}\n`
        t += `${je} ${demande} au ${qualite} de remettre ${cfg.article}${cfg.labelMin} dans le conteneur.\n\n`

      } else {
        // Titre uniquement si plusieurs unités
        if (nbUnites > 1) {
          t += `${je} ${demande} au ${qualite} ${cfg.articleIndef} ${ordinal} ${cfg.labelMin}${unite.reference ? ` portant la réf. ${unite.reference}` : ''}.\n`
        } else if (unite.reference) {
          t += `${je} ${demande} au ${qualite} ${cfg.articleIndef} ${cfg.labelMin} portant la réf. ${unite.reference}.\n`
        }
        if (unite.descriptionMentions) t += `${unite.descriptionMentions}\n`

        if (unite.prelevementExamen && unite.detailPrelevementExamen) {
          t += `${je} prélève${deuxAgents ? 'ons' : ''} ${unite.detailPrelevementExamen} pour examen à ${deuxAgents ? 'notre' : 'mon'} bureau. Ces articles seront restitués au RDE après examen.\n`
        }

        if (unite.mentionFermeture === 'complet') {
          t += `${je} ${fais} refermer ${cfg.article} ${cfg.labelMin} et apposer dessus les mentions "Visite douane" et la date ${date}.\n\n`
        } else if (unite.mentionFermeture === 'libre' && unite.mentionLibre) {
          t += `${je} ${fais} refermer ${cfg.article} ${cfg.labelMin} et apposer la mention : "${unite.mentionLibre}".\n\n`
        } else {
          t += `\n`
        }
      }
    })
  }

  // Prélèvements labo
  if (ctrl.hasPrelevementsLabo && ctrl.prelevementsLabo.length > 0) {
    const nb = ctrl.prelevementsLabo.length
    const nousJe = deuxAgents ? 'Nous décidons' : 'Je décide'
    const mettons = deuxAgents ? 'Nous mettons ensuite' : 'Je mets ensuite'
    const emportons = deuxAgents ? 'nous emportons avec nous à notre bureau' : "j'emporte avec moi à mon bureau"
    const laissons = deuxAgents ? 'nous laissons' : 'je laisse'
    const civ = ctrl.commis.civilite || 'M.'
    const commisAppel = `${civ} ${ctrl.commis.prenom || ''} ${ctrl.commis.nom || ''}`.trim()
    const qualite = ctrl.commis.qualite === 'coursier' ? 'coursier' : 'commis'

    t += `${nousJe} d'effectuer ${nb} prélèvement${nb > 1 ? 's' : ''}.\n\n`

    ctrl.prelevementsLabo.forEach((p, i) => {
      const modePrelev = p.modePrelev || 'sachets'
      const qteNum = parseInt(p.quantite) || 1
      const qteStr = qteNum > 1 ? `${qteNum} pièces` : '1 pièce'
      const ref = p.reference || '[référence non renseignée]'

      t += `Le prélèvement n°${i + 1} contient ${qteStr} de la référence "${ref}". `
      t += `Je demande à ${commisAppel} cette même référence en 4 exemplaires qui sont prélevés dans différentes parties de la marchandise.\n`

      if (modePrelev === 'sachets') {
        t += `${mettons} ce prélèvement dans des sachets portant les numéros de scellés suivants :\n`

        const sachets = [
          { num: p.scelleS1, dest: p.sachet1, label: 'Sachet 1 (pour la douane)' },
          { num: p.scelleS2, dest: p.sachet2, label: 'Sachet 2 (pour la douane)' },
          { num: p.scelleS3, dest: p.sachet3, label: 'Sachet 3 (pour la douane)' },
        ]
        sachets.forEach(s => {
          const destPhrase = s.dest === 'emporte'
            ? `${emportons} ce sachet afin de l'envoyer au laboratoire pour analyse`
            : `${laissons} ce sachet à ${lieu || 'TDF'}`
          t += `  • ${s.label} — scellé n° ${s.num || 'Non renseigné'} : ${destPhrase}\n`
        })

        // Sachet 4 RDE
        const s4phrase = p.sachet4 === 'laisse'
          ? `laissé à ${lieu || 'TDF'} et remis à ${commisAppel} pour le RDE`
          : `remis à ${commisAppel} et emporté chez le RDE`
        t += `  • Sachet 4 (RDE) — scellé n° ${p.scelleS4 || 'Non renseigné'} : ${s4phrase}\n\n`

      } else {
        t += `Le prélèvement est effectué à l'aide d'une pince à sceller et de ficelle résistante, scellé n° ${p.numeroScelle || 'Non renseigné'}.\n\n`
      }
    })
  } else {
    t += `${je} ne prélève${deuxAgents ? 'ons' : ''} aucun échantillon.\n\n`
  }

  if (isTerminal && ctrl.nouveauPlomb) {
    const fin = heureFinControle ? heureFinControle.replace(':', 'h') : '__h__'
    t += `${je} ${fais} refermer le conteneur et apposer un nouveau plomb commercial n° ${ctrl.nouveauPlomb} reconnu intègre. Fin des opérations de visite à ${fin}.\n\n`
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
    t += genVisiteConteneur(conteneur, ctrl, plombsBL?.[conteneur.id], date1, isTerminal, heureFinControle, deuxAgents, lieu1Court)
  }

  if (isTerminal && hasVisiteDepot && (controlesDepot || []).length > 0) {
    t += `${'═'.repeat(52)}\n`
    t += `VISITE 2 — DÉPOTAGE — ${lieu2} — ${date2} à ${heure2}\n`
    t += `${'═'.repeat(52)}\n\n`
    t += `Suite au contrôle au terminal ${lieu1Court} du ${date1}, la marchandise a fait l'objet d'un dépotage en magasin. Une seconde visite physique a été effectuée.\n\n`
    for (const conteneur of conteneurs || []) {
      const ctrl = (controlesDepot || []).find(c => c.conteneurId === conteneur.id)
      t += genVisiteConteneur(conteneur, ctrl, null, date2, false, null, deuxAgents, lieuControleDepot || 'entrepôt')
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

  const [sending, setSending] = useState(false)
  const [sendStatus, setSendStatus] = useState(null)
  const [sharing, setSharing] = useState(false)
  const [shareStatus, setShareStatus] = useState(null)

  async function handleShareSMS() {
    const crn = data.docDeclaration?.data?.crn || data.numeroDeclaration || 'controle'
    const date = data.dateControle || new Date().toISOString().slice(0, 10)
    const filename = `controle-${crn}-${date}.json`
    const jsonData = JSON.stringify(data, null, 2)

    setSharing(true)
    setShareStatus(null)
    try {
      const res = await fetch('/api/share-json', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonData, filename }),
      })
      const json = await res.json()
      if (!json.url) throw new Error('URL manquante')

      // Lien qui charge ctrlcust avec le JSON
      const shareUrl = `${window.location.origin}?import=${encodeURIComponent(json.url)}`
      const message = `Contrôle douanier ${crn} — ${date}\nOuvrir dans ctrlcust : ${shareUrl}`

      // Détecter iOS vs Android pour le format sms:
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent)
      const sep = isIOS ? '&' : '?'
      window.open(`sms:${sep}body=${encodeURIComponent(message)}`)

      setShareStatus('ok')
    } catch (err) {
      setShareStatus('error')
    } finally {
      setSharing(false)
      setTimeout(() => setShareStatus(null), 4000)
    }
  } // 'ok' | 'error' | null

  async function handleSendEmail() {
    const crn = data.docDeclaration?.data?.crn || data.numeroDeclaration || 'controle'
    const date = data.dateControle || new Date().toISOString().slice(0, 10)
    const filename = `controle-${crn}-${date}.json`
    const jsonData = JSON.stringify(data, null, 2)

    // Téléchargement local — sur mobile iOS on ouvre dans un nouvel onglet
    const blob = new Blob([jsonData], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
    if (isMobile) {
      window.open(url, '_blank')
    } else {
      const a = document.createElement('a')
      a.href = url; a.download = filename; a.click()
      URL.revokeObjectURL(url)
    }

    // Envoi par mail via Resend
    setSending(true)
    setSendStatus(null)
    try {
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'jerompestel@gmail.com',
          subject: `Contrôle douanier — ${crn} — ${date}`,
          jsonData,
          filename,
        }),
      })
      const json = await res.json()
      setSendStatus(json.success ? 'ok' : 'error')
    } catch {
      setSendStatus('error')
    } finally {
      setSending(false)
      setTimeout(() => setSendStatus(null), 4000)
    }
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

  const [copiedMail, setCopiedMail] = useState(false)

  function generateMailRDE() {
    const crn = data.docDeclaration?.data?.crn || data.numeroDeclaration || '[N° déclaration]'
    const date = formatDate(data.dateControle) || '__/__/____'
    const heure = data.heureControle ? data.heureControle.replace(':', 'h') : '__h__'
    const importateur = data.importateur || '[Importateur]'
    const representant = data.representant && data.representant !== 'Case vide' ? data.representant : '[RDE]'
    const agent = data.nomAgent || '[Nom agent]'
    const civ = data.civiliteAgent || 'M.'

    // Récupérer tous les prélèvements labo de tous les conteneurs
    const allPrelevements = []
    ;(data.controles || []).forEach(ctrl => {
      if (ctrl.hasPrelevementsLabo && ctrl.prelevementsLabo?.length > 0) {
        ctrl.prelevementsLabo.forEach(p => allPrelevements.push(p))
      }
    })

    if (allPrelevements.length === 0) return ''

    let mail = `Objet : Prélèvement pour analyse laboratoire — Déclaration N° ${crn} — ${date}\n\n`
    mail += `Madame, Monsieur,\n\n`
    mail += `Dans le cadre du contrôle douanier effectué le ${date} à ${heure} `
    mail += `sur la déclaration d'importation N° ${crn} déposée pour le compte de ${importateur}, `
    mail += `${civ} ${agent}, contrôleur des douanes au bureau du Havre, `
    mail += `a procédé à ${allPrelevements.length} prélèvement${allPrelevements.length > 1 ? 's' : ''} pour analyse laboratoire.\n\n`

    mail += `DÉTAIL DES PRÉLÈVEMENTS :\n`
    mail += `${'─'.repeat(40)}\n`
    allPrelevements.forEach((p, i) => {
      mail += `Prélèvement n°${i + 1} :\n`
      mail += `  Référence : ${p.reference || 'Non renseignée'}\n`
      mail += `  Quantité  : ${p.quantite || 'Non renseignée'}\n`
      if ((p.modePrelev || 'sachets') === 'sachets') {
        mail += `  Scellés   : Sachet 1 n°${p.scelleS1 || '-'} / Sachet 2 n°${p.scelleS2 || '-'} / Sachet 3 n°${p.scelleS3 || '-'} / Sachet 4 (RDE) n°${p.scelleS4 || '-'}\n`
      } else {
        mail += `  Scellé pince : ${p.numeroScelle || 'Non renseigné'}\n`
      }
    })

    mail += `\nNous vous remercions de bien vouloir nous faire parvenir, dans les meilleurs délais, `
    mail += `la fiche de représentativité dûment complétée et signée pour chacun des prélèvements effectués.\n\n`
    mail += `Ce document est nécessaire pour valider la représentativité des échantillons prélevés `
    mail += `et permettre l'analyse laboratoire dans les conditions réglementaires requises.\n\n`
    mail += `Nous restons à votre disposition pour tout renseignement complémentaire.\n\n`
    mail += `Cordialement,\n\n`
    mail += `${civ} ${agent}\n`
    mail += `Contrôleur des douanes — Bureau du Havre`

    return mail
  }

  const mailRDE = generateMailRDE()

  function handleCopyMail() {
    if (!mailRDE) return
    navigator.clipboard.writeText(mailRDE).then(() => {
      setCopiedMail(true)
      setTimeout(() => setCopiedMail(false), 2500)
    })
  }

  return (
    <>
      <div className="card">
        <div className="card-title">Compte rendu de contrôle</div>
        <div className="compte-rendu-box">{texte}</div>
        <div style={{ display: 'flex', alignItems: 'center', marginTop: '0.85rem', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="btn btn-primary" onClick={handleCopy}>Copier le texte</button>
          <button className="btn btn-secondary" onClick={handleSendEmail} disabled={sending}>
            {sending ? '⏳ Envoi…' : '📤 Envoyer par mail (JSON)'}
          </button>
          <button className="btn btn-secondary" onClick={handleShareSMS} disabled={sharing}>
            {sharing ? '⏳ Génération du lien…' : '💬 Partager par SMS'}
          </button>
          {copied && <span className="copy-feedback">✓ Copié !</span>}
          {sendStatus === 'ok' && <span style={{ color: '#166534', fontWeight: 600 }}>✓ Mail envoyé !</span>}
          {sendStatus === 'error' && <span style={{ color: '#dc2626', fontWeight: 600 }}>✗ Erreur mail</span>}
          {shareStatus === 'ok' && <span style={{ color: '#166534', fontWeight: 600 }}>✓ Lien généré !</span>}
          {shareStatus === 'error' && <span style={{ color: '#dc2626', fontWeight: 600 }}>✗ Erreur partage</span>}
        </div>
      </div>

      {mailRDE && (
        <div className="card">
          <div className="card-title">✉️ Mail RDE — Demande de fiche de représentativité</div>
          <div className="alert alert-info" style={{ marginBottom: '0.75rem' }}>
            Copiez ce texte et collez-le dans votre messagerie pour l'envoyer au représentant en douane.
          </div>
          <div className="compte-rendu-box" style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem' }}>
            {mailRDE}
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <button className="btn btn-primary" onClick={handleCopyMail}>
              {copiedMail ? '✓ Copié !' : 'Copier le texte du mail'}
            </button>
          </div>
        </div>
      )}

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
