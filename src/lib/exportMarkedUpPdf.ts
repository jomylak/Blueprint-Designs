import { PDFDocument, StandardFonts, rgb, type RGB } from "pdf-lib";
import { groupRegionsByPage } from "./utils";

interface Region {
  id: string;
  name: string;
  pageNumber: number;
  // Each pair is a fraction of the rendered page width (see BlueprintView.tsx) - both x and y
  // are scaled by the same reference (page width), which keeps aspect ratio intact regardless
  // of zoom or window size.
  points: number[];
  materialId: string | null;
  area: number;
  color: string;
}

interface Material {
  id: string;
  name: string;
  pricePerSqFt: number;
}

function hexToRgb(hex: string): RGB {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  return rgb(((bigint >> 16) & 255) / 255, ((bigint >> 8) & 255) / 255, (bigint & 255) / 255);
}

const PAGE_WIDTH = 612; // US Letter, in PDF points
const PAGE_HEIGHT = 792;
const MARGIN = 50;

// Builds one PDF: a nicely formatted estimation summary (grouped by page, matching the
// Estimation Summary tab) as the front page(s), followed by the original blueprint pages
// with each region's outline and name burned directly onto the page it belongs to.
export async function exportMarkedUpPdf(
  pdfData: Uint8Array,
  regions: Region[],
  materials: Material[],
  projectName: string
): Promise<Uint8Array> {
  const finalDoc = await PDFDocument.create();
  const font = await finalDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await finalDoc.embedFont(StandardFonts.HelveticaBold);

  const black = rgb(0, 0, 0);
  const gray = rgb(0.4, 0.4, 0.4);

  // --- Summary front page(s) ---
  const pageGroups = groupRegionsByPage(regions, materials);
  const totalArea = regions.reduce((sum, r) => sum + r.area, 0);
  const totalCost = pageGroups.reduce((sum, p) => sum + p.subtotalCost, 0);

  let page = finalDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  const ensureSpace = (needed: number) => {
    if (y - needed < MARGIN) {
      page = finalDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      y = PAGE_HEIGHT - MARGIN;
    }
  };

  const writeLine = (
    text: string,
    opts: { size?: number; bold?: boolean; color?: RGB; gap?: number } = {}
  ) => {
    const size = opts.size ?? 10;
    const gap = opts.gap ?? 6;
    ensureSpace(size + gap);
    page.drawText(text, {
      x: MARGIN,
      y: y - size,
      size,
      font: opts.bold ? boldFont : font,
      color: opts.color ?? black,
    });
    y -= size + gap;
  };

  writeLine(projectName || "Untitled Project", { size: 20, bold: true, gap: 4 });
  writeLine("Estimation Summary", { size: 13, color: gray, gap: 2 });
  writeLine(new Date().toLocaleDateString(), { size: 9, color: gray, gap: 18 });

  const COLS = { name: MARGIN, material: MARGIN + 170, area: MARGIN + 300, price: MARGIN + 370, cost: MARGIN + 450 };
  const drawRow = (cells: [string, string, string, string, string], opts: { bold?: boolean } = {}) => {
    ensureSpace(14);
    const f = opts.bold ? boldFont : font;
    page.drawText(cells[0], { x: COLS.name, y: y - 9, size: 9, font: f, color: black });
    page.drawText(cells[1], { x: COLS.material, y: y - 9, size: 9, font: f, color: black });
    page.drawText(cells[2], { x: COLS.area, y: y - 9, size: 9, font: f, color: black });
    page.drawText(cells[3], { x: COLS.price, y: y - 9, size: 9, font: f, color: black });
    page.drawText(cells[4], { x: COLS.cost, y: y - 9, size: 9, font: f, color: black });
    y -= 14;
  };

  pageGroups.forEach(group => {
    ensureSpace(20);
    writeLine(`Page ${group.pageNumber}`, { size: 12, bold: true, gap: 8 });
    drawRow(["Region", "Material", "Area (sqft)", "$/sqft", "Cost"], { bold: true });
    y -= 2;

    group.rows.forEach(row => {
      drawRow([
        row.name,
        row.materialName,
        row.area.toFixed(2),
        row.pricePerSqFt !== null ? `$${row.pricePerSqFt.toFixed(2)}` : "-",
        row.pricePerSqFt !== null ? `$${row.cost.toFixed(2)}` : "-",
      ]);
    });

    y -= 2;
    drawRow(["", "", `Page ${group.pageNumber} subtotal`, "", `$${group.subtotalCost.toFixed(2)}`], { bold: true });
    y -= 20;
  });

  ensureSpace(24);
  writeLine(`Total Area: ${totalArea.toFixed(2)} sq ft      Total Estimated Cost: $${totalCost.toFixed(2)}`, {
    size: 12,
    bold: true,
    gap: 0,
  });

  // --- Annotated blueprint pages ---
  const originalDoc = await PDFDocument.load(pdfData);
  const copiedPages = await finalDoc.copyPages(originalDoc, originalDoc.getPageIndices());
  copiedPages.forEach(p => finalDoc.addPage(p));

  const regionsByPage = new Map<number, Region[]>();
  regions.forEach(r => {
    if (!regionsByPage.has(r.pageNumber)) regionsByPage.set(r.pageNumber, []);
    regionsByPage.get(r.pageNumber)!.push(r);
  });

  copiedPages.forEach((blueprintPage, idx) => {
    const pageNumber = idx + 1;
    const pageRegions = regionsByPage.get(pageNumber);
    if (!pageRegions || pageRegions.length === 0) return;

    const nativeWidth = blueprintPage.getWidth();
    const nativeHeight = blueprintPage.getHeight();

    pageRegions.forEach(region => {
      const color = hexToRgb(region.color);
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i < region.points.length; i += 2) {
        const fx = region.points[i];
        const fy = region.points[i + 1];
        // Both fractions are relative to page width; flip y since our fraction is measured
        // from the top of the page but PDF coordinates start from the bottom.
        pts.push({ x: fx * nativeWidth, y: nativeHeight - fy * nativeWidth });
      }
      if (pts.length < 3) return;

      for (let i = 0; i < pts.length; i++) {
        blueprintPage.drawLine({
          start: pts[i],
          end: pts[(i + 1) % pts.length],
          thickness: 1.5,
          color,
          opacity: 0.9,
        });
      }

      // Region name label at the polygon's centroid, on a small white chip for legibility
      // over blueprint linework.
      const cx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
      const cy = pts.reduce((s, p) => s + p.y, 0) / pts.length;
      const label = region.name;
      const labelSize = 8;
      const labelWidth = font.widthOfTextAtSize(label, labelSize);
      blueprintPage.drawRectangle({
        x: cx - labelWidth / 2 - 3,
        y: cy - labelSize / 2 - 2,
        width: labelWidth + 6,
        height: labelSize + 6,
        color: rgb(1, 1, 1),
        opacity: 0.8,
        borderColor: color,
        borderWidth: 0.75,
      });
      blueprintPage.drawText(label, {
        x: cx - labelWidth / 2,
        y: cy - labelSize / 2,
        size: labelSize,
        font: boldFont,
        color: black,
      });
    });
  });

  return finalDoc.save();
}
