// The chart's symbols, drawn in ink about a point, so the chart and its key
// draw them the same way. Each is about 14 units across.

import type { TerrainKind } from './geometry.ts'

export function Mountain() {
  return (
    <g className="glyph-mountain">
      <path d="M-7,3 L-2,-5.5 L0,-3 L2.6,-7.5 L8,3" />
      <path className="shade" d="M2.6,-7.5 L1.8,3 M4.1,-4.6 L3.7,3 M5.6,-1.8 L5.4,3" />
    </g>
  )
}

export function Hill() {
  return (
    <g className="glyph-hill">
      <path d="M-6.5,2.5 Q-3,-3.2 0,-3.4 Q3,-3.2 6.5,2.5" />
      <path className="shade" d="M1.2,-2.6 L0.6,1.6 M3.2,-1.6 L2.8,1.8" />
    </g>
  )
}

const TREES: [number, number][] = [
  [-4.2, 1.6],
  [0, -1.2],
  [4.2, 1.6],
]

export function Forest() {
  return (
    <g className="glyph-forest">
      {TREES.map(([x, y]) => (
        <g key={`${x},${y}`} transform={`translate(${x} ${y})`}>
          <path className="trunk" d="M0,0 V2" />
          <circle cy={-1.6} r={2.5} />
        </g>
      ))}
    </g>
  )
}

export function Marsh() {
  return (
    <g className="glyph-marsh">
      <path d="M-6.5,2 H-1.5 M1.5,2 H6.5 M-4,-0.6 H2.5 M-3.5,2 V-1.4 M-2.4,2 L-3.4,-0.8 M3.8,2 V-1.2 M4.8,2 L5.8,-0.6" />
    </g>
  )
}

const STIPPLE: [number, number][] = [
  [-5, 1],
  [-1.5, -1.5],
  [2, 1.2],
  [5, -1],
  [0.5, 3],
]

export function Steppe() {
  return (
    <g className="glyph-steppe">
      {STIPPLE.map(([x, y]) => (
        <circle key={`${x},${y}`} cx={x} cy={y} r={0.75} />
      ))}
    </g>
  )
}

/** The symbol for a kind of terrain. */
export function TerrainGlyph({ kind }: { kind: TerrainKind }) {
  switch (kind) {
    case 'mountains':
      return <Mountain />
    case 'hills':
      return <Hill />
    case 'forest':
      return <Forest />
    case 'marsh':
      return <Marsh />
    case 'steppe':
      return <Steppe />
  }
}

export function Capital() {
  return (
    <g className="glyph-capital">
      <circle r={3.4} />
      <circle className="dot" r={1.3} />
    </g>
  )
}

export function Town() {
  return <circle className="glyph-town" r={1.7} />
}

export function Anchor() {
  return (
    <g className="glyph-anchor">
      <circle cy={-6.6} r={1.4} />
      <path d="M0,-5.2 V5 M-2.6,-2.6 H2.6 M-4.4,1.2 Q-4.2,5 0,5 Q4.2,5 4.4,1.2" />
    </g>
  )
}

/** Smoke rising from a fire: a country in unrest. */
export function Smoke() {
  return (
    <g className="glyph-smoke">
      <circle className="puff puff-1" cy={-6} r={2.6} />
      <circle className="puff puff-2" cx={1.5} cy={-11} r={3.2} />
      <circle className="puff puff-3" cx={-0.5} cy={-17} r={3.9} />
      <path className="flame" d="M0,1 Q-3,-2 -0.4,-6.5 Q0.6,-3.5 1.6,-4.6 Q3,-1.6 0,1 Z" />
    </g>
  )
}

/** Crossed swords: hostile to the player. */
export function Swords() {
  return (
    <g className="glyph-swords">
      <path d="M-5.5,-5.5 L5,5 M5.5,-5.5 L-5,5 M-6,-2.8 L-2.8,-6 M6,-2.8 L2.8,-6" />
      <circle cx={5.6} cy={5.6} r={1.1} />
      <circle cx={-5.6} cy={5.6} r={1.1} />
    </g>
  )
}

/** A crane over scaffolding: a project under way. */
export function Crane() {
  return (
    <g className="glyph-crane">
      <path d="M-1,5 V-8 H8 M-1,-8 L-4,-5.5 M-1,-4 L3,-8 M6.5,-8 V-4.5" />
      <rect x={-4} y={1} width={6} height={4} />
    </g>
  )
}

/** A glint of gilt: a booming town. */
export function Glint() {
  return <path className="glyph-glint" d="M0,-4.2 L1,-1 L4.2,0 L1,1 L0,4.2 L-1,1 L-4.2,0 L-1,-1 Z" />
}

/** The crisis ring: a still ring and one that pulses outward. */
export function CrisisRing() {
  return (
    <g className="glyph-crisis">
      <circle className="pulse" r={10} />
      <circle r={10} />
    </g>
  )
}

/** A short run of railway, for the key. */
export function RailSample() {
  return (
    <g className="built-rail">
      <path d="M-8,0 H8" />
      <path className="ties" d="M-8,0 H8" />
    </g>
  )
}

export function CanalSample() {
  return (
    <g className="built-canal">
      <path d="M-8,0 H8" />
      <path className="water" d="M-8,0 H8" />
    </g>
  )
}

export function PylonsSample() {
  return (
    <g className="built-grid">
      <path d="M-8,0 H8" />
      <Pylon x={-4} y={0} />
      <Pylon x={4} y={0} />
    </g>
  )
}

export function Pylon({ x, y }: { x: number; y: number }) {
  return <path className="pylon" d={`M${x - 1.8},${y + 2} L${x},${y - 2.6} L${x + 1.8},${y + 2} M${x - 1.6},${y - 1} H${x + 1.6}`} />
}
