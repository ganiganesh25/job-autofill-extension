import type { Field, FillOutcome } from './App'

interface Props {
  field: Field
  /** Already masked for display — see previewValue. */
  value: string
  checked: boolean
  outcome: FillOutcome | undefined
  disabled: boolean
  onToggle: () => void
  onRetry: () => void
}

/** Dropdowns and file inputs behave differently enough to be worth flagging. */
function controlHint(field: Field): string | null {
  if (field.control === 'combobox' || field.control === 'select') return 'dropdown'
  if (field.control === 'file') return 'file'
  return null
}

export function FieldRow({
  field,
  value,
  checked,
  outcome,
  disabled,
  onToggle,
  onRetry,
}: Props) {
  const hint = controlHint(field)
  const id = `field-${field.index}`

  return (
    <div className={outcome ? `field-row ${outcome}` : 'field-row'}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        disabled={disabled || outcome === 'filled'}
        onChange={onToggle}
      />
      <label htmlFor={id} className="field-row-label">
        <span className="field-name">
          {field.label || field.type}
          {hint && <span className="hint">{hint}</span>}
        </span>
        <span className="field-value">{value}</span>
      </label>
      {/* Outcome is stated in text as well as colour, so it survives a
          colour-vision deficiency and reaches screen readers. */}
      {outcome === 'filled' && <span className="outcome ok">Filled</span>}
      {outcome === 'failed' && (
        <button className="subtle outcome-retry" onClick={onRetry} disabled={disabled}>
          Failed — retry
        </button>
      )}
    </div>
  )
}
