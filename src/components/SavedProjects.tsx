
import { useEffect, useState } from 'react';
import { useProject } from "@/context/ProjectContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { TrashIcon, FolderIcon, Edit } from "lucide-react";
import { toast } from "sonner";

interface SavedProject {
  id: string;
  name: string;
  date: string;
  data: any;
}

// Local saves only ever store { id, name, date, data } - preview stats are derived from data
// here rather than relied on as a separate stored field, so this works regardless of when/how
// the project was saved.
function getPreview(project: SavedProject) {
  const regions = project.data?.regions || [];
  const materials = project.data?.materials || [];
  const materialById = new Map(materials.map((m: any) => [m.id, m]));
  const totalCost = regions.reduce((sum: number, region: any) => {
    const material = materialById.get(region.materialId) as any;
    return material ? sum + material.pricePerSqFt * region.area : sum;
  }, 0);
  return { regionsCount: regions.length, materialsCount: materials.length, totalCost };
}

const SavedProjects = () => {
  const { loadProject } = useProject();
  const [savedProjects, setSavedProjects] = useState<SavedProject[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadSavedProjects();
  }, []);

  const loadSavedProjects = () => {
    try {
      const projectsJson = localStorage.getItem('builderEstimationProjects');
      if (projectsJson) {
        const projectsData = JSON.parse(projectsJson);
        setSavedProjects(projectsData);
      }
    } catch (error) {
      console.error('Error loading saved projects:', error);
      toast.error('Failed to load saved projects');
    }
  };

  const handleLoadProject = (project: SavedProject) => {
    try {
      loadProject(project.data);
      toast.success(`Loaded project: ${project.name}`);
    } catch (error) {
      console.error('Error loading project:', error);
      toast.error('Failed to load project');
    }
  };

  const handleDeleteProject = (projectId: string) => {
    try {
      const updatedProjects = savedProjects.filter(p => p.id !== projectId);
      localStorage.setItem('builderEstimationProjects', JSON.stringify(updatedProjects));
      setSavedProjects(updatedProjects);
      toast.success('Project deleted successfully');
    } catch (error) {
      console.error('Error deleting project:', error);
      toast.error('Failed to delete project');
    }
  };

  const filteredProjects = searchTerm
    ? savedProjects.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : savedProjects;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Saved Projects</h2>
        <Input
          placeholder="Search projects..."
          className="max-w-xs"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>
      
      {filteredProjects.length === 0 && (
        <div className="text-center py-12 border rounded-lg bg-muted/20">
          <FolderIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Saved Projects</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm ? 'No projects match your search' : 'Save a project to see it here'}
          </p>
        </div>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProjects.map((project) => {
          const preview = getPreview(project);
          return (
          <Card key={project.id} className="overflow-hidden hover:shadow-md transition-shadow">
            <CardContent className="p-0">
              <div className="p-4 border-b bg-muted/10">
                <div className="flex justify-between items-start">
                  <h3 className="font-medium truncate" title={project.name}>
                    {project.name}
                  </h3>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDeleteProject(project.id)}
                    className="h-8 w-8 -mt-1 -mr-1"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{project.date}</p>
              </div>
              <div className="p-4 space-y-2">
                <div className="grid grid-cols-3 text-sm">
                  <div>
                    <p className="text-muted-foreground">Regions</p>
                    <p className="font-medium">{preview.regionsCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Materials</p>
                    <p className="font-medium">{preview.materialsCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Est. Cost</p>
                    <p className="font-medium">${preview.totalCost.toFixed(2)}</p>
                  </div>
                </div>
                
                <Button 
                  onClick={() => handleLoadProject(project)}
                  className="w-full mt-2"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Open Project
                </Button>
              </div>
            </CardContent>
          </Card>
          );
        })}
      </div>
    </div>
  );
};

export default SavedProjects;
