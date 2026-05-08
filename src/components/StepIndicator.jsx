export default function StepIndicator({ steps, currentStep }) {
  return (
    <nav className="step-indicator">
      {steps.map((s, i) => {
        const state = currentStep > s.id ? 'done' : currentStep === s.id ? 'active' : 'pending'
        // Le connecteur est "done" si le step précédent est terminé
        const connectorDone = i > 0 && currentStep > steps[i - 1].id
        return (
          <div key={s.id} className="step-item">
            {i > 0 && <div className={`step-connector ${connectorDone ? 'done' : ''}`} />}
            <div className={`step-circle ${state}`}>{state === 'done' ? '✓' : i + 1}</div>
            <span className={`step-label ${state === 'active' ? 'active' : ''}`}>{s.label}</span>
          </div>
        )
      })}
    </nav>
  )
}
