import type { EffectLine } from '../engine/index.ts'

const MARKS = { good: '▲', bad: '▼', neutral: '•' } as const
const SPOKEN = { good: ', helps', bad: ', hurts', neutral: '' } as const

/**
 * What a choice will do, one effect a line: green with an up arrow when it
 * helps, red with a down arrow when it hurts, plain when it is neither. Inside
 * a label, where a list can't go, it is written in spans.
 */
export function EffectList({
  lines,
  label,
  className = 'effects',
  inLabel = false,
}: {
  lines: EffectLine[]
  label?: string
  className?: string
  inLabel?: boolean
}) {
  if (lines.length === 0) return null
  const items = lines.map((line, index) => {
    const content = (
      <>
        <span className="effect-mark" aria-hidden="true">
          {MARKS[line.tone]}
        </span>
        <span>
          {line.text}
          {SPOKEN[line.tone] && <span className="visually-hidden">{SPOKEN[line.tone]}</span>}
        </span>
      </>
    )
    const key = `${index}-${line.text}`
    const lineClass = `effect effect-${line.tone}`
    return inLabel ? (
      <span key={key} className={lineClass}>
        {content}
      </span>
    ) : (
      <li key={key} className={lineClass}>
        {content}
      </li>
    )
  })
  return inLabel ? (
    <span className={className}>{items}</span>
  ) : (
    <ul className={className} aria-label={label}>
      {items}
    </ul>
  )
}
