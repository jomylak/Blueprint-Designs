
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const REGION_COLORS = [
  "#f97316", // orange
  "#3b82f6", // blue
  "#10b981", // emerald
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#6366f1", // indigo
  "#f59e0b", // amber
  "#6b7280", // gray
  "#0ea5e9", // sky
  "#84cc16", // lime
  "#d946ef", // fuchsia
];

export function generateRandomColor(): string {
  return REGION_COLORS[Math.floor(Math.random() * REGION_COLORS.length)];
}

interface RegionLike {
  id: string;
  name: string;
  pageNumber: number;
  materialId: string | null;
  area: number;
  color: string;
}

interface MaterialLike {
  id: string;
  name: string;
  pricePerSqFt: number;
}

export interface RegionSummaryRow {
  id: string;
  name: string;
  color: string;
  materialName: string;
  pricePerSqFt: number | null;
  area: number;
  cost: number;
}

export interface PageSummaryGroup {
  pageNumber: number;
  rows: RegionSummaryRow[];
  subtotalArea: number;
  subtotalCost: number;
}

// Group regions by blueprint page for the Estimation Summary view and the exported PDF's
// summary pages, so both stay in sync with a single source of truth.
export function groupRegionsByPage(regions: RegionLike[], materials: MaterialLike[]): PageSummaryGroup[] {
  const byPage = new Map<number, RegionSummaryRow[]>();

  for (const region of regions) {
    const material = materials.find(m => m.id === region.materialId) || null;
    const row: RegionSummaryRow = {
      id: region.id,
      name: region.name || `Region ${region.id.slice(-4)}`,
      color: region.color,
      materialName: material ? material.name : "Unassigned",
      pricePerSqFt: material ? material.pricePerSqFt : null,
      area: region.area,
      cost: material ? material.pricePerSqFt * region.area : 0,
    };
    if (!byPage.has(region.pageNumber)) byPage.set(region.pageNumber, []);
    byPage.get(region.pageNumber)!.push(row);
  }

  return Array.from(byPage.entries())
    .sort(([a], [b]) => a - b)
    .map(([pageNumber, rows]) => ({
      pageNumber,
      rows,
      subtotalArea: rows.reduce((sum, r) => sum + r.area, 0),
      subtotalCost: rows.reduce((sum, r) => sum + r.cost, 0),
    }));
}

// Calculate polygon area using Shoelace formula
export function calculatePolygonArea(points: number[]): number {
  let area = 0;
  const numPoints = points.length / 2;

  for (let i = 0, j = numPoints - 1; i < numPoints; j = i++) {
    const x1 = points[i * 2];
    const y1 = points[i * 2 + 1];
    const x2 = points[j * 2];
    const y2 = points[j * 2 + 1];
    area += x1 * y2;
    area -= y1 * x2;
  }

  area = Math.abs(area) / 2;
  return area;
}

// Real-world length (in feet) of each edge of a closed polygon, wrapping the last point back
// to the first. `points` are fraction-of-page-width pairs (see BlueprintView.tsx) and `scale`
// is fraction-of-width units per foot (set during calibration), so dividing by it directly
// yields feet - the same convention calculatePolygonArea/scale^2 uses for square feet.
export function polygonEdgeLengthsFeet(points: number[], scale: number): number[] {
  const n = points.length / 2;
  const lengths: number[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const dx = points[j * 2] - points[i * 2];
    const dy = points[j * 2 + 1] - points[i * 2 + 1];
    lengths.push(Math.sqrt(dx * dx + dy * dy) / (scale || 1));
  }
  return lengths;
}

// Converts a real-world length in feet to/from the unit the user calibrated with (ft/in/m/cm).
// Mirrors the conversion used when calibrating (BlueprintView's handleCalibrationSave).
export function feetToDisplayUnit(feet: number, unit: string): number {
  switch (unit) {
    case "in": return feet * 12;
    case "m": return feet / 3.28084;
    case "cm": return feet * 30.48;
    default: return feet;
  }
}

export function displayUnitToFeet(value: number, unit: string): number {
  switch (unit) {
    case "in": return value / 12;
    case "m": return value * 3.28084;
    case "cm": return value / 30.48;
    default: return value;
  }
}

// Formats a length as feet + whole inches (e.g. 9'-11"), the standard construction/blueprint
// convention - instead of decimal feet. Rounded straight from the full-precision `feet` value
// (not from an already-rounded decimal), to the nearest inch.
export function formatFeetInches(feet: number): string {
  const sign = feet < 0 ? "-" : "";
  const absFeet = Math.abs(feet);
  let wholeFeet = Math.floor(absFeet);
  let wholeInches = Math.round((absFeet - wholeFeet) * 12);
  if (wholeInches >= 12) {
    wholeFeet += 1;
    wholeInches = 0;
  }
  return wholeFeet > 0 ? `${sign}${wholeFeet}'-${wholeInches}"` : `${sign}${wholeInches}"`;
}

// Same idea but for a pure-inches measurement (no feet breakdown) - used when the project was
// calibrated in inches rather than feet.
export function formatInchesWhole(totalInches: number): string {
  const sign = totalInches < 0 ? "-" : "";
  const whole = Math.round(Math.abs(totalInches));
  return `${sign}${whole}"`;
}

export function formatLength(feet: number, unit: string): string {
  if (unit === "ft") return formatFeetInches(feet);
  if (unit === "in") return formatInchesWhole(feet * 12);
  return `${feetToDisplayUnit(feet, unit).toFixed(1)}${unit}`;
}

export interface EdgeLabelSpec {
  edgeIndex: number;
  lengthFeet: number;
  text: string;
  x: number; // label center, in the same rendered-pixel space as the SVG overlay
  y: number;
  angleDeg: number; // rotate the label to read along the edge (never upside down)
  fontSize: number;
  width: number; // estimated rendered width of the label chip, at fontSize
}

const EDGE_LABEL_CHAR_WIDTH = 0.62; // rough width-per-character, relative to font size
const EDGE_LABEL_PADDING = 6;

// Lays out one length label per polygon edge: sized to fit within its own edge (shrinking
// down to a minimum, then omitted entirely rather than spilling into a neighboring label) and
// nudged toward the polygon's interior along the edge's inward normal, so labels on two
// regions' adjacent/shared edges land on opposite sides of the line instead of colliding.
// Also rotated to read along the edge (flat on horizontal edges, sideways on vertical ones).
export function computeEdgeLabels(
  points: number[],
  scale: number,
  scaleUnit: string,
  renderedWidth: number,
  opts: { closed?: boolean; baseFontSize?: number; minFontSize?: number; inset?: number } = {}
): EdgeLabelSpec[] {
  const closed = opts.closed ?? true;
  const baseFontSize = opts.baseFontSize ?? 9;
  const minFontSize = opts.minFontSize ?? 6;
  const inset = opts.inset ?? 9;
  const n = points.length / 2;
  const edgeCount = closed ? n : n - 1;
  if (edgeCount < 1 || n < 2) return [];

  let cx = 0, cy = 0;
  for (let i = 0; i < n; i++) {
    cx += points[i * 2];
    cy += points[i * 2 + 1];
  }
  cx /= n;
  cy /= n;

  const specs: EdgeLabelSpec[] = [];
  for (let i = 0; i < edgeCount; i++) {
    const j = (i + 1) % n;
    const ax = points[i * 2], ay = points[i * 2 + 1];
    const bx = points[j * 2], by = points[j * 2 + 1];
    const dx = bx - ax, dy = by - ay;
    const edgeLenFrac = Math.sqrt(dx * dx + dy * dy);
    if (edgeLenFrac === 0) continue;

    const lengthFeet = edgeLenFrac / (scale || 1);
    const text = formatLength(lengthFeet, scaleUnit);

    const edgePixelLen = edgeLenFrac * renderedWidth;
    const available = Math.max(0, edgePixelLen - 4);
    const neededAtBase = text.length * baseFontSize * EDGE_LABEL_CHAR_WIDTH + EDGE_LABEL_PADDING;
    let fontSize = baseFontSize;
    if (neededAtBase > available) {
      const neededAtMin = text.length * minFontSize * EDGE_LABEL_CHAR_WIDTH + EDGE_LABEL_PADDING;
      if (neededAtMin > available) continue; // wouldn't fit even at the minimum - skip it
      fontSize = Math.max(minFontSize, (available - EDGE_LABEL_PADDING) / (text.length * EDGE_LABEL_CHAR_WIDTH));
    }
    const width = text.length * fontSize * EDGE_LABEL_CHAR_WIDTH + EDGE_LABEL_PADDING;

    const midXf = (ax + bx) / 2, midYf = (ay + by) / 2;
    let nx = -dy / edgeLenFrac, ny = dx / edgeLenFrac;
    if (nx * (cx - midXf) + ny * (cy - midYf) < 0) {
      nx = -nx;
      ny = -ny;
    }

    let angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;
    if (angleDeg > 90) angleDeg -= 180;
    if (angleDeg < -90) angleDeg += 180;

    specs.push({
      edgeIndex: i,
      lengthFeet,
      text,
      x: midXf * renderedWidth + nx * inset,
      y: midYf * renderedWidth + ny * inset,
      angleDeg,
      fontSize,
      width,
    });
  }
  return specs;
}

function orientation(ax: number, ay: number, bx: number, by: number, cx: number, cy: number): number {
  const val = (by - ay) * (cx - bx) - (bx - ax) * (cy - by);
  if (Math.abs(val) < 1e-12) return 0;
  return val > 0 ? 1 : 2;
}

function onSegment(ax: number, ay: number, bx: number, by: number, px: number, py: number): boolean {
  return (
    px <= Math.max(ax, bx) + 1e-9 && px >= Math.min(ax, bx) - 1e-9 &&
    py <= Math.max(ay, by) + 1e-9 && py >= Math.min(ay, by) - 1e-9
  );
}

function segmentsIntersect(
  ax: number, ay: number, bx: number, by: number,
  cx: number, cy: number, dx: number, dy: number
): boolean {
  const o1 = orientation(ax, ay, bx, by, cx, cy);
  const o2 = orientation(ax, ay, bx, by, dx, dy);
  const o3 = orientation(cx, cy, dx, dy, ax, ay);
  const o4 = orientation(cx, cy, dx, dy, bx, by);

  if (o1 !== o2 && o3 !== o4) return true;
  if (o1 === 0 && onSegment(ax, ay, bx, by, cx, cy)) return true;
  if (o2 === 0 && onSegment(ax, ay, bx, by, dx, dy)) return true;
  if (o3 === 0 && onSegment(cx, cy, dx, dy, ax, ay)) return true;
  if (o4 === 0 && onSegment(cx, cy, dx, dy, bx, by)) return true;
  return false;
}

const SHARED_ENDPOINT_EPS = 1e-6;
function sameFractionPoint(x1: number, y1: number, x2: number, y2: number): boolean {
  return Math.abs(x1 - x2) < SHARED_ENDPOINT_EPS && Math.abs(y1 - y2) < SHARED_ENDPOINT_EPS;
}

// Checks whether the candidate segment (x1,y1)-(x2,y2) crosses any edge of `points`
// (fraction-of-page-width pairs, see BlueprintView.tsx) - an open polyline (the shape currently
// being drawn) by default, or a closed polygon (an already-completed region) with
// `opts.closed`. Edges that share an endpoint with the candidate segment - e.g. the edge the new
// segment continues from, or (when checking a closing edge) the edge the polygon started from -
// are skipped, since sharing a vertex by construction isn't a crossing. Used while drawing a
// region to stop a segment from cutting back across the shape's own outline, or across another
// region's outline.
export function segmentCrossesPolyline(
  points: number[],
  x1: number, y1: number,
  x2: number, y2: number,
  opts: { closed?: boolean } = {}
): boolean {
  const n = points.length / 2;
  const edgeCount = opts.closed ? n : n - 1;
  for (let i = 0; i < edgeCount; i++) {
    const j = (i + 1) % n;
    const ax = points[i * 2], ay = points[i * 2 + 1];
    const bx = points[j * 2], by = points[j * 2 + 1];
    if (
      sameFractionPoint(ax, ay, x1, y1) || sameFractionPoint(bx, by, x1, y1) ||
      sameFractionPoint(ax, ay, x2, y2) || sameFractionPoint(bx, by, x2, y2)
    ) {
      continue;
    }
    if (segmentsIntersect(x1, y1, x2, y2, ax, ay, bx, by)) return true;
  }
  return false;
}

export interface RegionNameLabelSpec {
  x: number;
  y: number;
  fontSize: number;
  text: string;
}

// Places a region's name at its centroid, styled the same way as edge length labels (halo
// text, no background box). Only returned when the region's on-screen bounding box is
// comfortably bigger than the text, so small regions just don't get a name label rather than
// having it overflow the shape.
export function computeRegionNameLabel(
  points: number[],
  name: string,
  renderedWidth: number,
  opts: { fontSize?: number } = {}
): RegionNameLabelSpec | null {
  if (!name) return null;
  const fontSize = opts.fontSize ?? 11;
  const n = points.length / 2;
  if (n < 3) return null;

  let cx = 0, cy = 0, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = points[i * 2], y = points[i * 2 + 1];
    cx += x;
    cy += y;
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  cx /= n;
  cy /= n;

  const textWidth = name.length * fontSize * EDGE_LABEL_CHAR_WIDTH + EDGE_LABEL_PADDING;
  const bboxWidthPx = (maxX - minX) * renderedWidth;
  const bboxHeightPx = (maxY - minY) * renderedWidth;
  if (bboxWidthPx < textWidth + 16 || bboxHeightPx < fontSize * 3.5) return null;

  return { x: cx * renderedWidth, y: cy * renderedWidth, fontSize, text: name };
}
