const STATUS_ICON = { ok: '✓', warning: '⚠', error: '✗', missing: '–' }
const STATUS_LABEL = { ok: 'Concordant', warning: 'À vérifier', error: 'Anomalie', missing: 'Incomplet' }

export default function ConcordancePanel({ checks, title = 'Analyse de concordance' }) {
  if (!checks || checks.length === 0) return null

  const total = checks.length
  const ok = checks.filter(c => c.status === 'ok').length
  const warnings = checks.filter(c => c.status === 'warning').length
  const errors = checks.filter(c => c.status === 'error').length

  return (
    <section className="card concordance-panel">
      <h3 className="card-title">{title}</h3>

      {/* Résumé */}
      <div className="concordance-summary">
        <span className="badge badge-ok">{ok} concordant{ok > 1 ? 's' : ''}</span>
        {warnings > 0 && <span className="badge badge-warning">{warnings} à vérifier</span>}
        {errors > 0 && <span className="badge badge-error">{errors} anomalie{errors > 1 ? 's' : ''}</span>}
        <span className="badge badge-total">sur {total} contrôles</span>
      </div>

      {/* Checks */}
      <div className="concordance-checks">
        {checks.map(check => (
          <CheckBlock key={check.id} check={check} />
        ))}
      </div>
    </section>
  )
}

function CheckBlock({ check }) {
  return (
    <div className={`check-block check-${check.status}`}>
      <div className="check-header">
        <span className={`check-icon check-icon-${check.status}`}>
          {STATUS_ICON[check.status]}
        </span>
        <span className="check-label">{check.label}</span>
        <span className={`check-status-label status-${check.status}`}>
          {STATUS_LABEL[check.status]}
        </span>
      </div>

      {check.rows && check.rows.length > 0 && (
        <div className="check-rows">
          {check.rows.map((row, i) => (
            <div key={i} className={`check-row check-row-${row.status}`}>
              <div className="check-row-label">{row.label}</div>
              <div className="check-row-values">
                {row.values.map((v, j) => (
                  <div key={j} className="check-row-value">
                    <span className="check-source">{typeof v.source === 'string' ? v.source : ''}</span>
                    <span className="check-value">{typeof v.value === 'string' ? v.value : (v.found ? '✓' : '✗')}</span>
                  </div>
                ))}
              </div>
              {row.message && (
                <div className={`check-message check-message-${row.status}`}>{row.message}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
