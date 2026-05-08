export default function Step2PlombsBL({ data, update }) {
  function setPlomb(conteneurId, value) {
    update({ plombsBL: { ...data.plombsBL, [conteneurId]: value.toUpperCase() } })
  }

  return (
    <div className="card">
      <div className="card-title">Numéros de plombs — Bill of Lading</div>
      <div className="alert alert-info">
        Saisissez les numéros de plombs (scellés) tels qu'ils figurent sur le Bill of Lading pour chaque conteneur. Ils seront comparés aux plombs réels lors du contrôle terrain.
      </div>

      {data.conteneurs.map((c, i) => (
        <div className="form-group" key={c.id}>
          <label>Conteneur #{i + 1} — <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{c.numero}</span></label>
          <input
            type="text"
            placeholder="Numéro de plomb BL (ex. ABC12345)"
            value={data.plombsBL[c.id] ?? ''}
            onChange={e => setPlomb(c.id, e.target.value)}
            style={{ fontFamily: 'monospace' }}
          />
        </div>
      ))}
    </div>
  )
}
