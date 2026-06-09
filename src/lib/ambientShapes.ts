import type { NoteName } from '../types/music';
import { ALL_NOTES } from './colors';

/** Reference-inspired silhouette families from the annotated mockups. */
export type AmbientShapeFamily =
  | 'steppedCove'
  | 'waveTop'
  | 'waveTopHump'
  | 'borderHump'
  | 'serpent'
  | 'twinPeaks'
  | 'doubleHump'
  | 'angularRidge';

export interface AmbientShapeLayout {
  fillAngle: number;
  bodyX: number;
  bodyY: number;
  hookX: number;
  hookY: number;
  rightWidth: number;
}

export interface AmbientShapeDefinition {
  maskId: string;
  family: AmbientShapeFamily;
  /** White regions in the SVG mask (where color bleeds through). */
  colorPaths: string[];
  layout: AmbientShapeLayout;
}

const NEUTRAL_MASK_ID = 'ambientGlowMask-neutral';

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function jagOffset(i: number, noteIndex: number, jagBase: number): number {
  const phase = noteIndex * 2.13;
  const wave =
    Math.sin(i * 2.05 + phase) * 0.62 +
    Math.sin(i * 3.75 + phase * 0.6) * 0.38 +
    Math.sin(i * 5.1 + phase * 1.2) * 0.22;
  const step = i % 2 === 0 ? 1.25 : -1;
  return (
    (wave * step + (i % 3 === 0 ? 0.55 : i % 5 === 0 ? -0.35 : 0)) * jagBase
  );
}

function jaggedEdge(
  from: [number, number],
  to: [number, number],
  noteIndex: number,
  segments: number,
  jagBase: number,
): string[] {
  const dx = to[0] - from[0];
  const dy = to[1] - from[1];
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const lines: string[] = [];

  for (let i = 1; i <= segments; i += 1) {
    const t = i / segments;
    const x = from[0] + dx * t;
    const y = from[1] + dy * t;
    const jag = jagOffset(i, noteIndex, jagBase);
    lines.push(
      `L ${clamp01(x + nx * jag).toFixed(4)},${clamp01(y + ny * jag + jag * 0.12).toFixed(4)}`,
    );
  }

  return lines;
}

/** Closed polygon with a jagged break-up along every edge. */
function jaggedPolygon(
  points: [number, number][],
  noteIndex: number,
  segmentsPerEdge = 6,
): string {
  const jagBase = 0.028 + (noteIndex % 4) * 0.008;
  const parts = [
    `M ${points[0][0].toFixed(4)},${points[0][1].toFixed(4)}`,
  ];

  for (let i = 1; i < points.length; i += 1) {
    parts.push(
      ...jaggedEdge(points[i - 1], points[i], noteIndex, segmentsPerEdge, jagBase),
    );
  }

  parts.push(
    ...jaggedEdge(
      points[points.length - 1],
      points[0],
      noteIndex,
      segmentsPerEdge,
      jagBase,
    ),
  );
  parts.push('Z');
  return parts.join(' ');
}

type ShapeBlueprint = {
  family: AmbientShapeFamily;
  build: (noteIndex: number) => string[];
  layout: AmbientShapeLayout;
};

/*
 * Reference silhouettes (normalized 0–1 coords):
 * 1. steppedCove   — red stepped top-right cove (image 1 left)
 * 2. waveTop       — orange wavy top mass (image 1 right, top)
 * 3. waveTopHump   — orange top wave + bottom-left hump (image 1 right, both)
 * 4. borderHump    — lime left/bottom border + center hump (image 2 left)
 * 5. serpent       — green serpentine ridge (image 2 right)
 * 6. twinPeaks     — red twin-peaked range (image 3)
 * 7. doubleHump    — blue double hump (image 4 left)
 * 8. angularRidge  — purple angular ridge (image 4 right)
 */
const SHAPE_BLUEPRINTS: ShapeBlueprint[] = [
  {
    family: 'steppedCove',
    build: (noteIndex) => [
      jaggedPolygon(
        [
          [0, 0],
          [1, 0],
          [1, 1],
          [0.84, 0.9],
          [0.72, 0.78],
          [0.64, 0.68],
          [0.52, 0.58],
          [0.4, 0.62],
          [0.28, 0.48],
          [0.16, 0.4],
          [0, 0.34],
        ],
        noteIndex,
        5,
      ),
    ],
    layout: {
      fillAngle: 325,
      bodyX: 78,
      bodyY: 36,
      hookX: 88,
      hookY: 82,
      rightWidth: 56,
    },
  },
  {
    family: 'waveTopHump',
    build: (noteIndex) => [
      jaggedPolygon(
        [
          [0, 0],
          [1, 0],
          [1, 0.46],
          [0.92, 0.42],
          [0.78, 0.14],
          [0.58, 0.58],
          [0.38, 0.5],
          [0.18, 0.46],
          [0, 0.5],
        ],
        noteIndex,
        6,
      ),
      jaggedPolygon(
        [
          [0, 1],
          [0.44, 1],
          [0.28, 0.76],
          [0.14, 0.88],
          [0, 0.92],
        ],
        noteIndex,
        5,
      ),
    ],
    layout: {
      fillAngle: 310,
      bodyX: 72,
      bodyY: 28,
      hookX: 28,
      hookY: 84,
      rightWidth: 52,
    },
  },
  {
    family: 'borderHump',
    build: (noteIndex) => [
      jaggedPolygon(
        [
          [0, 0],
          [0, 1],
          [0.24, 1],
          [0.4, 0.8],
          [0.56, 0.36],
          [0.74, 0.76],
          [0.9, 1],
          [1, 1],
          [1, 0.66],
          [0.66, 0.5],
          [0.42, 0.44],
          [0, 0.38],
        ],
        noteIndex,
        6,
      ),
    ],
    layout: {
      fillAngle: 48,
      bodyX: 52,
      bodyY: 58,
      hookX: 24,
      hookY: 88,
      rightWidth: 38,
    },
  },
  {
    family: 'serpent',
    build: (noteIndex) => [
      jaggedPolygon(
        [
          [0, 1],
          [0.06, 0.86],
          [0.14, 0.72],
          [0.22, 0.58],
          [0.34, 0.24],
          [0.46, 0.54],
          [0.58, 0.34],
          [0.7, 0.16],
          [0.84, 0.06],
          [1, 0],
          [1, 1],
        ],
        noteIndex,
        5,
      ),
    ],
    layout: {
      fillAngle: 292,
      bodyX: 62,
      bodyY: 42,
      hookX: 84,
      hookY: 22,
      rightWidth: 48,
    },
  },
  {
    family: 'twinPeaks',
    build: (noteIndex) => [
      jaggedPolygon(
        [
          [0, 1],
          [0, 0],
          [0.26, 0],
          [0.36, 0.1],
          [0.46, 0.34],
          [0.56, 0.12],
          [0.66, 0.28],
          [0.74, 0.52],
          [0.82, 0.72],
          [0.88, 0.78],
          [0.94, 0.88],
          [1, 0.94],
          [1, 1],
        ],
        noteIndex,
        5,
      ),
    ],
    layout: {
      fillAngle: 342,
      bodyX: 44,
      bodyY: 32,
      hookX: 72,
      hookY: 68,
      rightWidth: 44,
    },
  },
  {
    family: 'doubleHump',
    build: (noteIndex) => [
      jaggedPolygon(
        [
          [0, 1],
          [0, 0.04],
          [0.16, 0],
          [0.3, 0.06],
          [0.4, 0.14],
          [0.5, 0.4],
          [0.62, 0.26],
          [0.74, 0.44],
          [0.88, 0.68],
          [1, 1],
        ],
        noteIndex,
        6,
      ),
    ],
    layout: {
      fillAngle: 334,
      bodyX: 48,
      bodyY: 38,
      hookX: 68,
      hookY: 58,
      rightWidth: 50,
    },
  },
  {
    family: 'angularRidge',
    build: (noteIndex) => [
      jaggedPolygon(
        [
          [0, 1],
          [0.08, 0.2],
          [0.16, 0.5],
          [0.26, 0.34],
          [0.36, 0.58],
          [0.46, 0.72],
          [0.56, 0.24],
          [0.66, 0.42],
          [0.76, 0.28],
          [0.86, 0.1],
          [1, 0],
          [1, 1],
        ],
        noteIndex,
        4,
      ),
    ],
    layout: {
      fillAngle: 286,
      bodyX: 58,
      bodyY: 46,
      hookX: 82,
      hookY: 18,
      rightWidth: 46,
    },
  },
  {
    family: 'waveTop',
    build: (noteIndex) => [
      jaggedPolygon(
        [
          [0, 0],
          [1, 0],
          [1, 0.48],
          [0.94, 0.44],
          [0.8, 0.16],
          [0.62, 0.54],
          [0.42, 0.48],
          [0.22, 0.44],
          [0, 0.48],
        ],
        noteIndex,
        6,
      ),
    ],
    layout: {
      fillAngle: 308,
      bodyX: 76,
      bodyY: 26,
      hookX: 86,
      hookY: 72,
      rightWidth: 54,
    },
  },
];

const NOTE_SHAPE_ORDER: number[] = [0, 1, 2, 3, 4, 5, 6, 7, 0, 1, 4, 6];

function maskIdForNote(note: NoteName): string {
  return `ambientGlowMask-${note.toLowerCase().replace('#', 's')}`;
}

function buildShapeDefinition(
  note: NoteName,
  noteIndex: number,
): AmbientShapeDefinition {
  const blueprint = SHAPE_BLUEPRINTS[NOTE_SHAPE_ORDER[noteIndex]];

  return {
    maskId: maskIdForNote(note),
    family: blueprint.family,
    colorPaths: blueprint.build(noteIndex),
    layout: blueprint.layout,
  };
}

export const AMBIENT_SHAPES: Record<NoteName, AmbientShapeDefinition> =
  ALL_NOTES.reduce(
    (acc, note, index) => {
      acc[note] = buildShapeDefinition(note, index);
      return acc;
    },
    {} as Record<NoteName, AmbientShapeDefinition>,
  );

export const NEUTRAL_AMBIENT_SHAPE: AmbientShapeDefinition = {
  maskId: NEUTRAL_MASK_ID,
  family: 'steppedCove',
  colorPaths: SHAPE_BLUEPRINTS[0].build(0),
  layout: SHAPE_BLUEPRINTS[0].layout,
};

export function getAmbientShape(root: NoteName | null): AmbientShapeDefinition {
  if (!root) return NEUTRAL_AMBIENT_SHAPE;
  return AMBIENT_SHAPES[root];
}

export function ambientMaskUrl(root: NoteName | null): string {
  return `url(#${getAmbientShape(root).maskId})`;
}

export const ALL_AMBIENT_SHAPE_DEFINITIONS: AmbientShapeDefinition[] = [
  NEUTRAL_AMBIENT_SHAPE,
  ...ALL_NOTES.map((note) => AMBIENT_SHAPES[note]),
];
