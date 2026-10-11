// The chart's fixed terrain, worked out once from geometry.ts: coastlines
// roughened so they look drawn by hand, and mountains, hills, forests, marsh
// and steppe scattered over each country's land. Everything comes from the
// seeded generator, so the chart is the same in every game and every visit.

import { createRng, GAME_DATA } from '../../engine/index.ts'
import type { Rng } from '../../engine/index.ts'
import {
  COUNTRY_SHAPES,
  MAP_HEIGHT,
  MAP_WIDTH,
  RIVERS,
  SETTLEMENTS,
  STRAIT_SHAPES,
  TERRAIN_ZONES,
} from './geometry.ts'
import type { TerrainKind } from './geometry.ts'

interface Point {
  x: number
  y: number
}

export interface TerrainSymbol {
  kind: TerrainKind
  x: number
  y: number
  scale: number
}

/** The points of each closed outline in a path made of M, L and Z. */
function rings(path: string): Point[][] {
  return path
    .split('Z')
    .map((part) => [...part.matchAll(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g)].map((match) => ({ x: +match[1], y: +match[2] })))
    .filter((ring) => ring.length > 2)
}

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

/** A whole number from some coordinates, to seed the generator for one stretch of coast. */
function seedFrom(...numbers: number[]): number {
  return numbers.reduce((hash, number) => Math.imul(hash ^ Math.round(number * 10), 0x01000193) >>> 0, 0x811c9dc5)
}

/** Points between p and q, nudged sideways at random, halving the stretch each time. */
function subdivide(p: Point, q: Point, depth: number, rng: Rng): Point[] {
  if (depth === 0) return []
  const length = distance(p, q)
  const amount = (rng.next() * 2 - 1) * Math.min(4.5, length * 0.16)
  const middle = {
    x: (p.x + q.x) / 2 - ((q.y - p.y) / length) * amount,
    y: (p.y + q.y) / 2 + ((q.x - p.x) / length) * amount,
  }
  return [...subdivide(p, middle, depth - 1, rng), middle, ...subdivide(middle, q, depth - 1, rng)]
}

/**
 * The hand-drawn points between two corners of an outline. A border shared
 * by two countries comes out exactly the same from both sides, because each
 * stretch is worked out in one fixed direction and reversed when needed.
 * Stretches along the edge of the chart stay straight.
 */
function roughStretch(a: Point, b: Point): Point[] {
  const onEdge =
    (a.x === b.x && (a.x === 0 || a.x === MAP_WIDTH)) || (a.y === b.y && (a.y === 0 || a.y === MAP_HEIGHT))
  if (onEdge || distance(a, b) < 6) return []
  const forward = a.x < b.x || (a.x === b.x && a.y < b.y)
  const [p, q] = forward ? [a, b] : [b, a]
  const points = subdivide(p, q, 2, createRng(seedFrom(p.x, p.y, q.x, q.y)))
  return forward ? points : points.reverse()
}

function roughRings(path: string): Point[][] {
  return rings(path).map((ring) => ring.flatMap((point, index) => [point, ...roughStretch(point, ring[(index + 1) % ring.length])]))
}

const toPath = (outline: Point[][]) =>
  outline.map((ring) => `M${ring.map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' L')} Z`).join(' ')

/** Each country's outline as drawn: the shape from geometry.ts with a hand-drawn coast. */
export const OUTLINES: Record<string, { path: string; rings: Point[][] }> = Object.fromEntries(
  Object.entries(COUNTRY_SHAPES).map(([id, shape]) => {
    const outline = roughRings(shape.path)
    return [id, { path: toPath(outline), rings: outline }]
  }),
)

function inside(point: Point, outline: Point[][]): boolean {
  let within = false
  for (const ring of outline) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const a = ring[i]
      const b = ring[j]
      if (a.y > point.y !== b.y > point.y && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) {
        within = !within
      }
    }
  }
  return within
}

function distanceToSegment(point: Point, a: Point, b: Point): number {
  const length = (b.x - a.x) ** 2 + (b.y - a.y) ** 2
  const t = length === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - a.x) * (b.x - a.x) + (point.y - a.y) * (b.y - a.y)) / length))
  return distance(point, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) })
}

function distanceToLine(point: Point, line: Point[], closed: boolean): number {
  let nearest = Infinity
  const count = closed ? line.length : line.length - 1
  for (let i = 0; i < count; i++) nearest = Math.min(nearest, distanceToSegment(point, line[i], line[(i + 1) % line.length]))
  return nearest
}

/** Boxes and circles the terrain keeps clear of: names, settlements, strait labels, rivers and the title block. */
function clearOf(point: Point): boolean {
  if (point.x < 216 && point.y < 92) return false
  for (const [id, shape] of Object.entries(COUNTRY_SHAPES)) {
    const name = GAME_DATA.countries.find((country) => country.id === id)?.name ?? id
    const halfWidth = (name.length * (id === 'kessara' ? 8.6 : 7.6)) / 2 + 8
    if (Math.abs(point.x - shape.label.x) < halfWidth && point.y > shape.label.y - 17 && point.y < shape.label.y + 7) return false
  }
  for (const places of Object.values(SETTLEMENTS)) {
    for (const place of [places.capital, places.port, ...places.towns]) if (distance(point, place) < 11) return false
  }
  for (const strait of Object.values(STRAIT_SHAPES)) {
    if (Math.abs(point.x - strait.label.x) < 58 && Math.abs(point.y - strait.label.y) < 20) return false
  }
  return RIVERS.every((river) => distanceToLine(point, river, false) > 6)
}

/** How much room each kind of symbol takes, from its middle. */
const SPACING: Record<TerrainKind, number> = { mountains: 13, hills: 12, forest: 14, marsh: 12, steppe: 10 }

/** The terrain symbols on each country, scattered over its zones. */
export const TERRAIN: Record<string, TerrainSymbol[]> = Object.fromEntries(
  Object.entries(TERRAIN_ZONES).map(([id, zones]) => {
    const outline = OUTLINES[id].rings
    const placed: TerrainSymbol[] = []
    zones.forEach((zone, zoneIndex) => {
      const rng = createRng(seedFrom(zoneIndex, zone.x, zone.y, id.length))
      let added = 0
      for (let attempt = 0; attempt < zone.count * 40 && added < zone.count; attempt++) {
        const angle = rng.next() * Math.PI * 2
        const reach = Math.sqrt(rng.next()) * zone.radius
        const point = { x: zone.x + Math.cos(angle) * reach, y: zone.y + Math.sin(angle) * reach }
        const roomy = placed.every((other) => distance(point, other) >= Math.max(SPACING[zone.kind], SPACING[other.kind]))
        const onLand = inside(point, outline) && outline.every((ring) => distanceToLine(point, ring, true) > 8)
        if (!roomy || !onLand || !clearOf(point)) continue
        placed.push({ kind: zone.kind, x: Math.round(point.x * 10) / 10, y: Math.round(point.y * 10) / 10, scale: 0.85 + rng.next() * 0.3 })
        added++
      }
    })
    return [id, placed]
  }),
)

/** A smooth line through points, as a path: a Catmull-Rom curve drawn with Bézier segments. */
export function smoothPath(points: Point[]): string {
  const at = (index: number) => points[Math.max(0, Math.min(points.length - 1, index))]
  let path = `M${points[0].x},${points[0].y}`
  for (let i = 0; i < points.length - 1; i++) {
    const [p0, p1, p2, p3] = [at(i - 1), at(i), at(i + 1), at(i + 2)]
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }
    path += ` C${c1.x.toFixed(1)},${c1.y.toFixed(1)} ${c2.x.toFixed(1)},${c2.y.toFixed(1)} ${p2.x},${p2.y}`
  }
  return path
}

export const RIVER_PATHS = RIVERS.map(smoothPath)
