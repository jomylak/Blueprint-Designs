
import { useProject } from "@/context/ProjectContext";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { TrashIcon } from "lucide-react";

interface RegionsListProps {
  regions: any[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

const RegionsList = ({ regions, selectedId, onSelect, onDelete }: RegionsListProps) => {
  const { materials, updateRegion } = useProject();

  const handleMaterialChange = (regionId: string, materialId: string) => {
    updateRegion(regionId, { materialId });
  };

  if (regions.length === 0) {
    return (
      <div className="text-center py-6 text-sm text-muted-foreground">
        No regions on this page.
        <p className="mt-1">Click "Draw Region" to create areas for estimation.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3 max-h-[400px] overflow-y-auto">
      {regions.map((region) => {
        const material = materials.find(m => m.id === region.materialId);
        return (
          <div 
            key={region.id}
            className={`p-3 border rounded-md ${selectedId === region.id ? 'border-primary bg-muted' : 'border-border'}`}
            onClick={() => onSelect(region.id)}
          >
            <div className="flex justify-between">
              <div className="flex items-center">
                <div 
                  className="w-4 h-4 rounded-full mr-2" 
                  style={{ backgroundColor: region.color }}
                />
                <span className="font-medium">Region {region.id.slice(-4)}</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(region.id);
                }}
                className="h-6 w-6"
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            </div>
            
            <div className="mt-2 text-sm">
              <div className="flex justify-between mb-1">
                <span className="text-muted-foreground">Area:</span>
                <span>{region.area.toFixed(2)} sq ft</span>
              </div>
              
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Material:</span>
                <div className="w-32">
                  <Select
                    value={region.materialId || ""}
                    onValueChange={(value) => handleMaterialChange(region.id, value)}
                  >
                    <SelectTrigger className="h-8">
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      {materials.map((material) => (
                        <SelectItem key={material.id} value={material.id}>
                          {material.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {material && (
                <div className="flex justify-between mt-1">
                  <span className="text-muted-foreground">Cost:</span>
                  <span>${(material.pricePerSqFt * region.area).toFixed(2)}</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default RegionsList;
