
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function generateRandomColor(): string {
  const colors = [
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
  
  return colors[Math.floor(Math.random() * colors.length)];
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

export function formatLength(feet: number, unit: string): string {
  return `${feetToDisplayUnit(feet, unit).toFixed(1)}${unit}`;
}
