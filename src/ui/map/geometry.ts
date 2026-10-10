// The shapes of the Meridian Sea map, in an 800 × 500 viewBox. One path per
// country (the Sabu Islands are one path with several islands) and one
// crossing per strait. Neighbouring countries share the exact border points,
// so there are no gaps. The ids match src/data/countries.json and
// src/data/straits.json. Redraw the map by editing the points here.

export const MAP_WIDTH = 800
export const MAP_HEIGHT = 500

interface Point {
  x: number
  y: number
}

export interface CountryShape {
  path: string
  label: Point
}

export const COUNTRY_SHAPES: Record<string, CountryShape> = {
  tsengai: {
    path:
      'M0,0 L560,0 L548,32 L522,44 L505,52 L480,58 L458,66 L436,70 L412,78 L390,88 L368,96 L348,104 ' +
      'L330,118 L292,134 L262,142 L232,148 L196,146 L160,150 L126,144 L92,140 L46,148 L0,152 Z',
    label: { x: 280, y: 96 },
  },
  halvard: {
    path:
      'M560,0 L800,0 L800,470 L770,466 L740,462 L706,456 L676,450 L648,446 L630,438 L616,424 L612,410 ' +
      'L618,390 L626,370 L636,350 L640,330 L636,312 L630,296 L618,278 L606,262 L594,246 L584,230 ' +
      'L576,212 L572,192 L574,172 L578,150 L576,130 L570,110 L564,90 L556,72 L552,52 L548,32 Z',
    label: { x: 692, y: 214 },
  },
  kessara: {
    path:
      'M292,134 L330,118 L348,124 L362,132 L386,138 L410,146 L434,152 L458,160 L480,168 L500,176 ' +
      'L512,184 L516,194 L508,204 L496,212 L474,218 L452,220 L426,222 L400,224 L374,228 L350,236 ' +
      'L324,240 L300,244 L292,230 L286,214 L294,198 L302,180 L296,156 Z',
    label: { x: 404, y: 192 },
  },
  ostrel: {
    path:
      'M160,150 L196,146 L232,148 L262,142 L292,134 L296,156 L302,180 L294,198 L286,214 L292,230 ' +
      'L300,244 L284,262 L268,276 L248,288 L226,298 L204,300 L180,302 L164,292 L150,282 L162,250 ' +
      'L176,214 L168,182 Z',
    label: { x: 230, y: 226 },
  },
  daranth: {
    path:
      'M0,152 L46,148 L92,140 L126,144 L160,150 L168,182 L176,214 L162,250 L150,282 L118,292 L84,300 ' +
      'L40,296 L0,292 Z',
    label: { x: 82, y: 224 },
  },
  valmora: {
    path:
      'M0,292 L40,296 L84,300 L118,292 L150,282 L164,292 L180,302 L204,300 L226,298 L240,312 L252,330 ' +
      'L258,352 L262,374 L282,386 L304,394 L326,402 L330,414 L316,422 L290,424 L262,422 L240,418 ' +
      'L222,434 L196,452 L166,464 L132,474 L96,480 L60,484 L28,482 L0,480 Z',
    label: { x: 120, y: 392 },
  },
  sabu: {
    path:
      'M440,384 L456,374 L474,372 L492,378 L504,390 L506,406 L496,418 L478,424 L458,422 L444,414 L438,400 Z ' +
      'M528,422 L540,414 L554,414 L566,424 L564,438 L552,446 L536,444 L526,434 Z ' +
      'M396,436 L406,428 L420,428 L428,438 L422,448 L408,452 L398,446 Z',
    label: { x: 474, y: 470 },
  },
}

export interface StraitShape {
  /** The two shores the strait runs between. */
  from: Point
  to: Point
  label: Point
}

export const STRAIT_SHAPES: Record<string, StraitShape> = {
  kessaraStrait: { from: { x: 518, y: 194 }, to: { x: 571, y: 192 }, label: { x: 540, y: 244 } },
  sabuPassage: { from: { x: 567, y: 430 }, to: { x: 613, y: 418 }, label: { x: 606, y: 468 } },
  valmoraChannel: { from: { x: 331, y: 413 }, to: { x: 395, y: 438 }, label: { x: 346, y: 462 } },
}

/** Where to write "Meridian Sea". */
export const SEA_LABEL: Point = { x: 440, y: 316 }
