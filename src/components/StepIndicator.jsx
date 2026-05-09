export default function StepIndicator({ steps, currentStep, onStepClick }) {
  return (
    <nav className="step-indicator">
      {steps.map((s, i) => {
        const state = currentStep > s.id ? 'done' : currentStep === s.id ? 'active' : 'pending'
        const connectorDone = i > 0 && currentStep > steps[i - 1].id
        const clickable = state === 'done' || state === 'active'
        return (
          <div key={s.id} className="step-item">
            {i > 0 && <div className={`step-connector ${connectorDone ? 'done' : ''}`} />}
            <div
              className={`step-circle ${state}${clickable ? ' clickable' : ''}`}
              onClick={() => clickable && onStepClick && onStepClick(s.id)}
              title={clickable ? `Aller à : ${s.label}` : ''}
            >
              {state === 'done' ? '✓' : i + 1}
            </div>
            <span
              className={`step-label ${state === 'active' ? 'active' : ''}${clickable ? ' clickable' : ''}`}
              onClick={() => clickable && onStepClick && onStepClick(s.id)}
            >
              {s.label}
            </span>
          </div>
        )
      })}
    </nav>
  )
}
