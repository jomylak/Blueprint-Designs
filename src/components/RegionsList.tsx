import { useProject } from "@/context/ProjectContext";
import { Button } from "@/components/ui/button";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Pencil, TrashIcon } from "lucide-react";
import { useState } from "react";
import { REGION_COLORS } from "@/lib/utils";

interface RegionsListProps {
  regions: any[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  editingRegionId?: string | null;
  onSaveEdit?: () => void;
  onCancelEdit?: () => void;
}

const RegionsList = ({
  regions,
  selectedId,
  onSelect,
  onDelete,
  editingRegionId,
  onSaveEdit,
  onCancelEdit,
}: RegionsListProps) => {
  const { materials, updateRegion } = useProject();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState<string>("");
  // Which region's color-swatch grid is currently open - only opens while that region's name
  // is being edited (clicking the pencil), and closes whenever name-editing ends.
  const [colorPickerId, setColorPickerId] = useState<string | null>(null);

  // Save edit and update region name everywhere (force update in context)
  const saveEdit = (regionId: string) => {
    updateRegion(regionId, { name: editingName });
    setEditingId(null);
    setColorPickerId(null);
  };

  const handleMaterialChange = (regionId: string, materialId: string) => {
    updateRegion(regionId, { materialId });
  };

  const startEditing = (regionId: string, currentName: string) => {
    setEditingId(regionId);
    setEditingName(currentName);
  };

  const handleKeyDown = (e: React.KeyboardEvent, regionId: string) => {
    if (e.key === "Enter") {
      saveEdit(regionId);
    } else if (e.key === "Escape") {
      setEditingId(null);
      setColorPickerId(null);
    }
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
        const isEditing = editingRegionId === region.id;
        return (
          <div 
            key={region.id}
            className={`p-3 border rounded-md ${selectedId === region.id ? 'border-primary bg-muted' : 'border-border'}`}
            onClick={() => onSelect(region.id)}
          >
            <div className="flex justify-between">
              <div className="flex items-center">
                <div className="relative mr-2">
                  <button
                    type="button"
                    className="w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: region.color, cursor: editingId === region.id ? "pointer" : "default" }}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (editingId !== region.id) return;
                      setColorPickerId(prev => (prev === region.id ? null : region.id));
                    }}
                  >
                    {editingId === region.id && (
                      <Pencil className="h-2.5 w-2.5 text-white" style={{ filter: "drop-shadow(0 0 1px rgba(0,0,0,0.8))" }} />
                    )}
                  </button>
                  {editingId === region.id && colorPickerId === region.id && (
                    <div
                      className="absolute z-20 top-5 left-0 p-2 bg-popover border border-border rounded-md shadow-md grid grid-cols-4 gap-1.5 w-max"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {REGION_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          className="w-5 h-5 rounded-full border-2"
                          style={{ backgroundColor: color, borderColor: color === region.color ? "#111827" : "transparent" }}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            updateRegion(region.id, { color });
                            setColorPickerId(null);
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
                {editingId === region.id ? (
                  <Input 
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={() => saveEdit(region.id)}
                    onKeyDown={(e) => handleKeyDown(e, region.id)}
                    className="h-6 w-32 px-1 py-0"
                    autoFocus
                  />
                ) : (
                  <span className="font-medium">{region.name || `Region ${region.id.slice(-4)}`}</span>
                )}
              </div>
              <div className="flex">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    startEditing(region.id, region.name || `Region ${region.id.slice(-4)}`);
                  }}
                  className="h-6 w-6 mr-1"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
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
            </div>
            {/* Show Save/Cancel for region point editing */}
            {isEditing && onSaveEdit && onCancelEdit && (
              <div className="flex gap-2 mt-2">
                <Button size="sm" variant="outline" onClick={onSaveEdit}>
                  Save Points
                </Button>
                <Button size="sm" variant="ghost" onClick={onCancelEdit}>
                  Cancel
                </Button>
              </div>
            )}
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
