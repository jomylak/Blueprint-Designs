
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

const EstimationSummary = () => {
  const { regions, materials, projectName } = useProject();
  const [sortField, setSortField] = useState<string>('page');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

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

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedRegions = [...regions].sort((a, b) => {
    let comparison = 0;
    
    switch (sortField) {
      case 'page':
        comparison = a.pageNumber - b.pageNumber;
        break;
      case 'area':
        comparison = a.area - b.area;
        break;
      case 'material':
        const materialA = materials.find(m => m.id === a.materialId)?.name || '';
        const materialB = materials.find(m => m.id === b.materialId)?.name || '';
        comparison = materialA.localeCompare(materialB);
        break;
      case 'cost':
        const costA = materials.find(m => m.id === a.materialId)?.pricePerSqFt * a.area || 0;
        const costB = materials.find(m => m.id === b.materialId)?.pricePerSqFt * b.area || 0;
        comparison = costA - costB;
        break;
      default:
        comparison = 0;
    }
    
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const exportToCSV = () => {
    // Create CSV content
    const headers = ['Page', 'Region', 'Material', 'Area (sq ft)', 'Price per sq ft', 'Total Cost'];
    
    const rows = sortedRegions.map(region => {
      const material = materials.find(m => m.id === region.materialId);
      return [
        region.pageNumber,
        `Region ${region.id.slice(-4)}`,
        material ? material.name : 'Unassigned',
        region.area.toFixed(2),
        material ? `$${material.pricePerSqFt.toFixed(2)}` : '-',
        material ? `$${(material.pricePerSqFt * region.area).toFixed(2)}` : '-'
      ];
    });
    
    // Add summary row
    rows.push(['', '', 'TOTAL', totalArea.toFixed(2), '', `$${totalCost.toFixed(2)}`]);
    
    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');
    
    // Create download link
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${projectName || 'estimation'}_summary.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
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
        <Button variant="outline" size="sm" onClick={exportToCSV}>
          <FileIcon className="h-4 w-4 mr-1" />
          Export to CSV
        </Button>
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
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead 
                  className={sortField === 'page' ? 'cursor-pointer underline' : 'cursor-pointer'}
                  onClick={() => handleSort('page')}
                >
                  Page
                </TableHead>
                <TableHead>Region</TableHead>
                <TableHead 
                  className={sortField === 'material' ? 'cursor-pointer underline' : 'cursor-pointer'}
                  onClick={() => handleSort('material')}
                >
                  Material
                </TableHead>
                <TableHead 
                  className={sortField === 'area' ? 'cursor-pointer underline' : 'cursor-pointer'}
                  onClick={() => handleSort('area')}
                >
                  Area (sq ft)
                </TableHead>
                <TableHead>Price per sq ft</TableHead>
                <TableHead 
                  className={`text-right ${sortField === 'cost' ? 'cursor-pointer underline' : 'cursor-pointer'}`}
                  onClick={() => handleSort('cost')}
                >
                  Total Cost
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRegions.map((region) => {
                const material = materials.find(m => m.id === region.materialId);
                return (
                  <TableRow key={region.id}>
                    <TableCell>{region.pageNumber}</TableCell>
                    <TableCell>
                      <div className="flex items-center">
                        <div 
                          className="w-3 h-3 rounded-full mr-2" 
                          style={{ backgroundColor: region.color }}
                        />
                        Region {region.id.slice(-4)}
                      </div>
                    </TableCell>
                    <TableCell>{material ? material.name : 'Unassigned'}</TableCell>
                    <TableCell>{region.area.toFixed(2)}</TableCell>
                    <TableCell>{material ? `$${material.pricePerSqFt.toFixed(2)}` : '-'}</TableCell>
                    <TableCell className="text-right">
                      {material ? `$${(material.pricePerSqFt * region.area).toFixed(2)}` : '-'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default EstimationSummary;
