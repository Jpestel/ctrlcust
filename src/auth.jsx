import { useState, useEffect, useRef } from 'react'

const MASTER_HASH_KEY = 'ctrlcust-master-hash'
const USERS_KEY = 'ctrlcust-users'
const SESSION_KEY = 'ctrlcust-session'

// Hash SHA-256 du PIN
async function hashPIN(pin) {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin + 'ctrlcust-salt-2026')
  const buf = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('')
}

// Initialiser le PIN maître par défaut au premier lancement
export async function initMasterPIN(defaultPIN) {
  if (!localStorage.getItem(MASTER_HASH_KEY)) {
    const hash = await hashPIN(defaultPIN)
    localStorage.setItem(MASTER_HASH_KEY, hash)
  }
}

// Vérifier un PIN et retourner le rôle ('master' | 'user' | null)
export async function verifyPIN(pin) {
  const hash = await hashPIN(pin)
  const masterHash = localStorage.getItem(MASTER_HASH_KEY)
  if (hash === masterHash) return 'master'
  const users = JSON.parse(localStorage.getItem(USERS_KEY) || '[]')
  if (users.some(u => u.hash === hash)) return 'user'
  return null
}

export function getSession() {
  try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) } catch { return null }
}
export function setSession(role) {
  sessionStorage.setItem(SESSION_KEY, JSON.stringify({ role }))
}
export function clearSession() {
  sessionStorage.removeItem(SESSION_KEY)
}

// ── Écran PIN ─────────────────────────────────────────────────────────────────
export function PINScreen({ onUnlock }) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  async function tryPIN(p) {
    const role = await verifyPIN(p)
    if (role) {
      setSession(role)
      onUnlock(role)
    } else {
      setError(true); setShake(true); setPin('')
      setTimeout(() => setShake(false), 500)
      setTimeout(() => setError(false), 2000)
    }
  }

  function press(k) {
    if (k === '⌫') { setPin(p => p.slice(0, -1)); return }
    if (pin.length >= 5) return
    const next = pin + k
    setPin(next)
    if (next.length === 5) setTimeout(() => tryPIN(next), 120)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#0f172a',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', zIndex: 9999,
    }}>
      <style>{`
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-8px)}
          40%{transform:translateX(8px)}
          60%{transform:translateX(-6px)}
          80%{transform:translateX(6px)}
        }
      `}</style>
      <div style={{ textAlign: 'center', color: '#fff' }}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔒</div>
        <div style={{ fontSize: '1.4rem', fontWeight: 700, marginBottom: '0.25rem' }}>ctrlcust</div>
        <div style={{ fontSize: '0.9rem', color: '#94a3b8', marginBottom: '2rem' }}>
          Saisir le code d'accès
        </div>

        {/* Points PIN */}
        <div style={{
          display: 'flex', gap: '0.75rem', justifyContent: 'center', marginBottom: '1.75rem',
          animation: shake ? 'shake 0.4s ease' : 'none',
        }}>
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{
              width: '14px', height: '14px', borderRadius: '50%',
              background: pin.length > i ? (error ? '#ef4444' : '#3b82f6') : '#334155',
              transition: 'background 0.15s',
            }} />
          ))}
        </div>

        {/* Pavé numérique */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', maxWidth: '240px', margin: '0 auto' }}>
          {[1,2,3,4,5,6,7,8,9,'',0,'⌫'].map((k, i) => (
            <button key={i} onClick={() => k !== '' && press(String(k))}
              style={{
                background: k === '' ? 'transparent' : '#1e293b',
                border: 'none', borderRadius: '0.6rem',
                color: '#fff', fontSize: '1.3rem', fontWeight: 600,
                padding: '0.9rem', cursor: k === '' ? 'default' : 'pointer',
              }}>
              {k}
            </button>
          ))}
        </div>

        {error && (
          <div style={{ color: '#ef4444', marginTop: '1.25rem', fontSize: '0.9rem' }}>
            Code incorrect
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page Admin ────────────────────────────────────────────────────────────────
export function AdminPage({ onClose }) {
  const [tab, setTab] = useState('users') // 'users' | 'master'
  const [users, setUsers] = useState(() => JSON.parse(localStorage.getItem(USERS_KEY) || '[]'))
  const [newLabel, setNewLabel] = useState('')
  const [newPIN, setNewPIN] = useState('')
  const [newPINConfirm, setNewPINConfirm] = useState('')
  const [msg, setMsg] = useState(null)
  const [masterPIN, setMasterPIN] = useState('')
  const [masterPINConfirm, setMasterPINConfirm] = useState('')

  function flash(text, ok = true) {
    setMsg({ text, ok })
    setTimeout(() => setMsg(null), 3000)
  }

  function saveUsers(list) {
    setUsers(list)
    localStorage.setItem(USERS_KEY, JSON.stringify(list))
  }

  async function addUser() {
    if (!newLabel.trim()) return flash('Saisissez un nom pour cet utilisateur', false)
    if (newPIN.length !== 5) return flash('Le PIN doit comporter 5 chiffres', false)
    if (newPIN !== newPINConfirm) return flash('Les deux PIN ne correspondent pas', false)
    const hash = await hashPIN(newPIN)
    const masterHash = localStorage.getItem(MASTER_HASH_KEY)
    if (hash === masterHash) return flash('Ce PIN est déjà celui du maître', false)
    if (users.some(u => u.hash === hash)) return flash('Ce PIN existe déjà', false)
    saveUsers([...users, { id: Date.now(), label: newLabel.trim(), hash }])
    setNewLabel(''); setNewPIN(''); setNewPINConfirm('')
    flash('Utilisateur ajouté ✓')
  }

  function removeUser(id) {
    saveUsers(users.filter(u => u.id !== id))
  }

  async function changeMasterPIN() {
    if (masterPIN.length !== 5) return flash('Le PIN maître doit comporter 5 chiffres', false)
    if (masterPIN !== masterPINConfirm) return flash('Les deux PIN ne correspondent pas', false)
    const hash = await hashPIN(masterPIN)
    localStorage.setItem(MASTER_HASH_KEY, hash)
    setMasterPIN(''); setMasterPINConfirm('')
    flash('PIN maître modifié ✓')
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h2 style={{ margin: 0, color: 'var(--color-primary)' }}>⚙️ Administration</h2>
        <button className="btn btn-secondary" onClick={onClose}>← Retour</button>
      </div>

      {msg && (
        <div style={{
          background: msg.ok ? '#dcfce7' : '#fee2e2',
          color: msg.ok ? '#166534' : '#dc2626',
          padding: '0.6rem 1rem', borderRadius: '0.5rem', marginBottom: '1rem',
          fontWeight: 600,
        }}>{msg.text}</div>
      )}

      {/* Onglets */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <button className={`btn ${tab === 'users' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('users')}>
          👥 Utilisateurs
        </button>
        <button className={`btn ${tab === 'master' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('master')}>
          🔑 PIN maître
        </button>
      </div>

      {/* Onglet Utilisateurs */}
      {tab === 'users' && (
        <div className="card">
          <div className="card-title">Utilisateurs autorisés</div>

          {users.length === 0 ? (
            <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem' }}>
              Aucun utilisateur. Ajoutez des PINs pour permettre l'accès à d'autres agents.
            </p>
          ) : (
            <div style={{ marginBottom: '1rem' }}>
              {users.map(u => (
                <div key={u.id} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '0.6rem 0', borderBottom: '1px solid var(--color-border)',
                }}>
                  <div>
                    <span style={{ fontWeight: 600 }}>{u.label}</span>
                    <span style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                      PIN : •••••
                    </span>
                  </div>
                  <button className="btn btn-ghost btn-sm"
                    onClick={() => removeUser(u.id)}
                    style={{ color: '#dc2626' }}>
                    Supprimer
                  </button>
                </div>
              ))}
            </div>
          )}

          <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: '1rem', marginTop: '0.5rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.75rem' }}>Ajouter un utilisateur</div>
            <div className="form-group">
              <label>Nom / Identifiant</label>
              <input type="text" placeholder="ex. Agent DUPONT"
                value={newLabel} onChange={e => setNewLabel(e.target.value)} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>PIN (5 chiffres)</label>
                <input type="password" inputMode="numeric" maxLength={5} placeholder="•••••"
                  value={newPIN} onChange={e => setNewPIN(e.target.value.replace(/\D/g, '').slice(0, 5))} />
              </div>
              <div className="form-group">
                <label>Confirmer le PIN</label>
                <input type="password" inputMode="numeric" maxLength={5} placeholder="•••••"
                  value={newPINConfirm} onChange={e => setNewPINConfirm(e.target.value.replace(/\D/g, '').slice(0, 5))} />
              </div>
            </div>
            <button className="btn btn-primary" onClick={addUser}>+ Ajouter</button>
          </div>
        </div>
      )}

      {/* Onglet PIN maître */}
      {tab === 'master' && (
        <div className="card">
          <div className="card-title">Modifier le PIN maître</div>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
            Seul le PIN maître donne accès à cette page d'administration.
          </p>
          <div className="form-row">
            <div className="form-group">
              <label>Nouveau PIN maître (5 chiffres)</label>
              <input type="password" inputMode="numeric" maxLength={5} placeholder="•••••"
                value={masterPIN} onChange={e => setMasterPIN(e.target.value.replace(/\D/g, '').slice(0, 5))} />
            </div>
            <div className="form-group">
              <label>Confirmer le nouveau PIN</label>
              <input type="password" inputMode="numeric" maxLength={5} placeholder="•••••"
                value={masterPINConfirm} onChange={e => setMasterPINConfirm(e.target.value.replace(/\D/g, '').slice(0, 5))} />
            </div>
          </div>
          <button className="btn btn-primary" onClick={changeMasterPIN}>Modifier le PIN maître</button>
        </div>
      )}
    </div>
  )
}
