
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
