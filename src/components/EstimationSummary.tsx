import { useState } from "react";
import { useProject } from "@/context/ProjectContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileIcon, TableIcon } from "lucide-react";
import { groupRegionsByPage } from "@/lib/utils";
import { saveTextToFile, saveBytesToFile } from "@/lib/fileIO";
import { exportMarkedUpPdf } from "@/lib/exportMarkedUpPdf";
import { toast } from "sonner";

const EstimationSummary = () => {
  const { regions, materials, projectName, pdfData, scale, scaleUnit } = useProject();
  const [exportingPdf, setExportingPdf] = useState(false);

  // Calculate totals
  const totalArea = regions.reduce((sum, region) => sum + region.area, 0);
  const totalCost = regions.reduce((sum, region) => {
    const material = materials.find(m => m.id === region.materialId);
    return sum + (material ? material.pricePerSqFt * region.area : 0);
  }, 0);

  // Group regions by material for the summary
  const materialSummary = materials.map(material => {
    const materialRegions = regions.filter(r => r.materialId === material.id);
    const area = materialRegions.reduce((sum, r) => sum + r.area, 0);
    const cost = area * material.pricePerSqFt;

    return {
      id: material.id,
      name: material.name,
      area,
      pricePerSqFt: material.pricePerSqFt,
      cost,
      count: materialRegions.length
    };
  }).filter(m => m.area > 0);

  const pageGroups = groupRegionsByPage(regions, materials);

  const exportToCSV = async () => {
    // Create CSV content, grouped by page to match the on-screen breakdown
    const headers = ['Page', 'Region', 'Material', 'Area (sq ft)', 'Price per sq ft', 'Total Cost'];

    const rows: (string | number)[][] = [];
    pageGroups.forEach(page => {
      page.rows.forEach(row => {
        rows.push([
          page.pageNumber,
          row.name,
          row.materialName,
          row.area.toFixed(2),
          row.pricePerSqFt !== null ? `$${row.pricePerSqFt.toFixed(2)}` : '-',
          row.pricePerSqFt !== null ? `$${row.cost.toFixed(2)}` : '-',
        ]);
      });
      rows.push([`Page ${page.pageNumber} subtotal`, '', '', page.subtotalArea.toFixed(2), '', `$${page.subtotalCost.toFixed(2)}`]);
    });

    // Add grand total row
    rows.push(['', '', 'TOTAL', totalArea.toFixed(2), '', `$${totalCost.toFixed(2)}`]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    await saveTextToFile(csvContent, `${projectName || 'estimation'}_summary.csv`, 'text/csv', ['csv']);
  };

  // Builds one PDF: the summary above (grouped by page) as front page(s), followed by the
  // original blueprint with each region's outline + name burned onto its page.
  const handleExportMarkedUpPdf = async () => {
    if (!pdfData) {
      toast.error('Upload a blueprint PDF first.');
      return;
    }
    setExportingPdf(true);
    try {
      const bytes = await exportMarkedUpPdf(pdfData, regions, materials, projectName, scale, scaleUnit);
      await saveBytesToFile(bytes, `${projectName || 'project'}_marked_up.pdf`, 'application/pdf', ['pdf']);
    } catch (error) {
      console.error('Error exporting marked-up PDF:', error);
      toast.error('Failed to export marked-up PDF.');
    } finally {
      setExportingPdf(false);
    }
  };

  if (regions.length === 0) {
    return (
      <div className="text-center py-12">
        <TableIcon className="h-12 w-12 mx-auto text-muted-foreground" />
        <h2 className="mt-4 text-lg font-medium">No regions to estimate</h2>
        <p className="text-muted-foreground mt-1">
          Go to the Blueprint View tab to draw regions on your blueprint.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Estimation Summary</h2>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={exportToCSV}>
            <FileIcon className="h-4 w-4 mr-1" />
            Export to CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportMarkedUpPdf}
            disabled={exportingPdf || !pdfData}
          >
            <FileIcon className="h-4 w-4 mr-1" />
            {exportingPdf ? 'Exporting...' : 'Export Marked-Up PDF'}
          </Button>
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base">Total Area</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{totalArea.toFixed(2)} sq ft</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base">Total Regions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{regions.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="py-4">
            <CardTitle className="text-base">Total Estimated Cost</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">${totalCost.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>
      
      {materialSummary.length > 0 && (
        <Card>
          <CardHeader className="py-4">
            <CardTitle>Material Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Material</TableHead>
                  <TableHead>Regions</TableHead>
                  <TableHead>Total Area (sq ft)</TableHead>
                  <TableHead>Price per sq ft</TableHead>
                  <TableHead className="text-right">Total Cost</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {materialSummary.map((summary) => (
                  <TableRow key={summary.id}>
                    <TableCell>{summary.name}</TableCell>
                    <TableCell>{summary.count}</TableCell>
                    <TableCell>{summary.area.toFixed(2)}</TableCell>
                    <TableCell>${summary.pricePerSqFt.toFixed(2)}</TableCell>
                    <TableCell className="text-right">${summary.cost.toFixed(2)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      
      <Card>
        <CardHeader className="py-4">
          <CardTitle>Detailed Region Breakdown</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {pageGroups.map(page => (
            <div key={page.pageNumber}>
              <h4 className="text-sm font-semibold mb-2">Page {page.pageNumber}</h4>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Region</TableHead>
                    <TableHead>Material</TableHead>
                    <TableHead>Area (sq ft)</TableHead>
                    <TableHead>Price per sq ft</TableHead>
                    <TableHead className="text-right">Total Cost</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {page.rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <div className="flex items-center">
                          <div
                            className="w-3 h-3 rounded-full mr-2"
                            style={{ backgroundColor: row.color }}
                          />
                          {row.name}
                        </div>
                      </TableCell>
                      <TableCell>{row.materialName}</TableCell>
                      <TableCell>{row.area.toFixed(2)}</TableCell>
                      <TableCell>{row.pricePerSqFt !== null ? `$${row.pricePerSqFt.toFixed(2)}` : '-'}</TableCell>
                      <TableCell className="text-right">
                        {row.pricePerSqFt !== null ? `$${row.cost.toFixed(2)}` : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="font-medium bg-muted/30">
                    <TableCell colSpan={2}>Page {page.pageNumber} subtotal</TableCell>
                    <TableCell>{page.subtotalArea.toFixed(2)}</TableCell>
                    <TableCell />
                    <TableCell className="text-right">${page.subtotalCost.toFixed(2)}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
};

export default EstimationSummary;
