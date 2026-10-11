/** Degrees each slice of the sweep covers, and how many trail behind its leading edge. */
const STEP = 4
const SLICES = 12

/**
 * A slow radar sweep turning about a point: a bright leading edge with a
 * fading wake behind it. The stylesheet turns it, and hides it for players
 * who ask for reduced motion.
 */
export function RadarSweep({ x, y, radius, className = '' }: { x: number; y: number; radius: number; className?: string }) {
  const at = (degrees: number) => {
    const angle = (degrees * Math.PI) / 180
    return `${(x + Math.cos(angle) * radius).toFixed(1)},${(y + Math.sin(angle) * radius).toFixed(1)}`
  }
  return (
    <g className={`sweep ${className}`} style={{ transformOrigin: `${x}px ${y}px` }} aria-hidden="true">
      {Array.from({ length: SLICES }, (_, index) => (
        <path
          key={index}
          d={`M${x},${y} L${at(-(index + 1) * STEP)} A${radius},${radius} 0 0 1 ${at(-index * STEP)} Z`}
          fillOpacity={(1 - index / SLICES) ** 2}
        />
      ))}
      <line className="sweep-edge" x1={x} y1={y} x2={x + radius} y2={y} />
    </g>
  )
}
