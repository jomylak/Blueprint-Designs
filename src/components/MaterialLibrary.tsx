
import { useState } from "react";
import { useProject } from "@/context/ProjectContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PlusIcon, TrashIcon, CheckIcon, XIcon } from "lucide-react";
import { toast } from "sonner";

const MaterialLibrary = () => {
  const { materials, addMaterial, updateMaterial, deleteMaterial } = useProject();
  
  const [newMaterial, setNewMaterial] = useState({ name: "", pricePerSqFt: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState({ name: "", pricePerSqFt: 0 });
  
  const handleAddMaterial = () => {
    if (!newMaterial.name.trim()) {
      toast.error("Please enter a material name");
      return;
    }
    
    if (newMaterial.pricePerSqFt <= 0) {
      toast.error("Please enter a valid price greater than zero");
      return;
    }
    
    addMaterial({
      name: newMaterial.name,
      pricePerSqFt: newMaterial.pricePerSqFt
    });
    
    setNewMaterial({ name: "", pricePerSqFt: 0 });
    toast.success("Material added successfully");
  };
  
  const startEditing = (material: any) => {
    setEditingId(material.id);
    setEditValues({
      name: material.name,
      pricePerSqFt: material.pricePerSqFt
    });
  };
  
  const cancelEditing = () => {
    setEditingId(null);
  };
  
  const saveEditing = (id: string) => {
    if (!editValues.name.trim()) {
      toast.error("Material name cannot be empty");
      return;
    }
    
    if (editValues.pricePerSqFt <= 0) {
      toast.error("Price must be greater than zero");
      return;
    }
    
    updateMaterial(id, editValues);
    setEditingId(null);
    toast.success("Material updated successfully");
  };
  
  const handleDeleteMaterial = (id: string) => {
    deleteMaterial(id);
    toast.success("Material deleted successfully");
  };
  
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Material Library</CardTitle>
          <CardDescription>
            Manage materials and their prices for cost estimation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material Name</TableHead>
                <TableHead>Price per sq ft</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.map((material) => (
                <TableRow key={material.id}>
                  <TableCell>
                    {editingId === material.id ? (
                      <Input 
                        value={editValues.name} 
                        onChange={(e) => setEditValues({...editValues, name: e.target.value})}
                      />
                    ) : (
                      material.name
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === material.id ? (
                      <Input 
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={editValues.pricePerSqFt} 
                        onChange={(e) => setEditValues({...editValues, pricePerSqFt: Number(e.target.value)})}
                      />
                    ) : (
                      `$${material.pricePerSqFt.toFixed(2)}`
                    )}
                  </TableCell>
                  <TableCell>
                    {editingId === material.id ? (
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => saveEditing(material.id)}
                        >
                          <CheckIcon className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={cancelEditing}
                        >
                          <XIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => startEditing(material)}
                        >
                          <PlusIcon className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          onClick={() => handleDeleteMaterial(material.id)}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader>
          <CardTitle>Add New Material</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="materialName">Material Name</Label>
              <Input
                id="materialName"
                value={newMaterial.name}
                onChange={(e) => setNewMaterial({...newMaterial, name: e.target.value})}
                placeholder="Enter material name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="materialPrice">Price per sq ft ($)</Label>
              <Input
                id="materialPrice"
                type="number"
                step="0.01"
                min="0.01"
                value={newMaterial.pricePerSqFt || ''}
                onChange={(e) => setNewMaterial({...newMaterial, pricePerSqFt: Number(e.target.value)})}
                placeholder="0.00"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleAddMaterial}>
                <PlusIcon className="h-4 w-4 mr-1" />
                Add Material
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MaterialLibrary;
