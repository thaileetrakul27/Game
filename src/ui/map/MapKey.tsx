import { useState } from 'react'
import type { ReactNode } from 'react'
import {
  Anchor,
  CanalSample,
  Capital,
  Crane,
  CrisisRing,
  Forest,
  Glint,
  Hill,
  Marsh,
  Mountain,
  PylonsSample,
  RailSample,
  Smoke,
  Steppe,
  Swords,
  Town,
} from './Glyphs.tsx'

/** One entry in the key: the mark as the chart draws it, and what it means. */
function Entry({ children, name, text }: { children: ReactNode; name: string; text?: string }) {
  return (
    <li className="key-entry">
      <svg className="key-glyph" viewBox="-12 -12 24 24" aria-hidden="true">
        {children}
      </svg>
      <span>
        <strong>{name}</strong>
        {text && <span className="key-text"> {text}</span>}
      </span>
    </li>
  )
}

/** The chart's key: what each mark means. It opens from a button in the corner of the chart. */
export function MapKey() {
  const [open, setOpen] = useState(false)
  return (
    <div className="map-key">
      <button type="button" className="key-button" aria-expanded={open} aria-controls="map-key" onClick={() => setOpen(!open)}>
        {open ? 'Close the key' : 'Key'}
      </button>
      {open && (
        <section id="map-key" className="key-card" aria-label="Key to the chart">
          <h2 className="key-heading">What the marks mean</h2>
          <ul className="plain key-list chart-ink">
            <Entry name="Crisis" text="This quarter's crisis is here.">
              <g transform="scale(0.9)">
                <CrisisRing />
              </g>
            </Entry>
            <Entry name="In unrest" text="Legitimacy has fallen, or a faction is restless.">
              <g transform="translate(0 7)">
                <Smoke />
              </g>
            </Entry>
            <Entry name="Hostile" text="Relations with you have broken down.">
              <Swords />
            </Entry>
            <Entry name="A client" text="Deep in a great power's camp, hatched in its colour.">
              <g className="key-hatch">
                <rect x="-9" y="-7" width="18" height="14" />
                <path d="M-9,1 L-1,-7 M-9,9 L7,-7 M-1,9 L9,-1" />
              </g>
            </Entry>
            <Entry name="Fortified" text="Strong defences, with battlements on its borders.">
              <path className="key-battlements" d="M-10,2 H10" />
            </Entry>
            <Entry name="Booming" text="Fast growth: its towns glint.">
              <Glint />
            </Entry>
            <Entry name="Trading with you" text="A trade deal in force, with a trader on the route.">
              <g className="trade-route">
                <path d="M-10,4 Q0,-8 10,4" />
                <circle className="trader" cx="0" cy="-2" r="2.6" />
              </g>
            </Entry>
            <Entry name="Building" text="A project under way.">
              <Crane />
            </Entry>
            <Entry name="Built" text="A port, a railway, a canal or power lines, once finished.">
              <g transform="translate(-6 -3) scale(0.7)">
                <Anchor />
              </g>
              <g transform="translate(4 -5) scale(0.55)">
                <RailSample />
              </g>
              <g transform="translate(4 2) scale(0.55)">
                <CanalSample />
              </g>
              <g transform="translate(4 8) scale(0.55)">
                <PylonsSample />
              </g>
            </Entry>
          </ul>
          <h3 className="key-heading small">The land</h3>
          <ul className="plain key-list key-land chart-ink">
            <Entry name="Capital and towns">
              <g transform="translate(-4 0)">
                <Capital />
              </g>
              <g transform="translate(6 2)">
                <Town />
              </g>
            </Entry>
            <Entry name="Mountains">
              <Mountain />
            </Entry>
            <Entry name="Hills">
              <Hill />
            </Entry>
            <Entry name="Forest">
              <Forest />
            </Entry>
            <Entry name="Marsh">
              <Marsh />
            </Entry>
            <Entry name="Steppe">
              <Steppe />
            </Entry>
          </ul>
        </section>
      )}
    </div>
  )
}
