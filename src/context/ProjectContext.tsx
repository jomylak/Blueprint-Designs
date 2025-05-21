
import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { toast } from "sonner";

interface Material {
  id: string;
  name: string;
  pricePerSqFt: number;
}

interface Region {
  id: string;
  name: string;
  pageNumber: number;
  points: number[];
  materialId: string | null;
  area: number;
  color: string;
}

interface ProjectContextType {
  pdf: File | null;
  pdfUrl: string | null;
  pageCount: number;
  currentPage: number;
  scale: number;
  scaleUnit: string;
  regions: Region[];
  materials: Material[];
  projectName: string;
  setProjectName: (name: string) => void;
  loadPdf: (file: File) => void;
  setCurrentPage: (page: number) => void;
  setScale: (scale: number) => void;
  setScaleUnit: (unit: string) => void;
  addRegion: (region: Omit<Region, 'id' | 'name'>) => void;
  updateRegion: (id: string, updates: Partial<Region>) => void;
  deleteRegion: (id: string) => void;
  addMaterial: (material: Omit<Material, 'id'>) => void;
  updateMaterial: (id: string, updates: Partial<Material>) => void;
  deleteMaterial: (id: string) => void;
  saveProject: () => void;
  loadProject: (data: any) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider = ({ children }: { children: React.ReactNode }) => {
  const [pdf, setPdf] = useState<File | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [scale, setScale] = useState(1);
  const [scaleUnit, setScaleUnit] = useState('ft');
  const [regions, setRegions] = useState<Region[]>([]);
  const [projectName, setProjectName] = useState('');
  
  const [materials, setMaterials] = useState<Material[]>([
    { id: '1', name: 'Ceramic Tile', pricePerSqFt: 5.99 },
    { id: '2', name: 'Hardwood', pricePerSqFt: 8.50 },
    { id: '3', name: 'Carpet', pricePerSqFt: 3.75 },
    { id: '4', name: 'Vinyl', pricePerSqFt: 2.99 },
  ]);

  const loadPdf = useCallback((file: File) => {
    // Revoke existing object URL to prevent memory leaks
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
    }

    setPdf(file);
    const url = URL.createObjectURL(file);
    setPdfUrl(url);
    
    // Set project name based on filename if not already set
    if (!projectName) {
      setProjectName(file.name.replace('.pdf', ''));
    }
    
    // Reset to first page when loading a new PDF
    setCurrentPage(1);
    
    // In a real app, we'd use a PDF library to get page count
    // For this prototype, we'll just set a placeholder value
    setPageCount(5); 
  }, [pdfUrl, projectName]);

  const addRegion = useCallback((region: Omit<Region, 'id' | 'name'>) => {
    setRegions(prev => {
      // Generate the next sequential region number
      const nextRegionNumber = prev.length + 1;
      const newRegion = { 
        ...region, 
        id: Date.now().toString(),
        name: `Region ${nextRegionNumber}`
      };
      return [...prev, newRegion];
    });
  }, []);

  const updateRegion = useCallback((id: string, updates: Partial<Region>) => {
    setRegions(prev => prev.map(region => 
      region.id === id ? { ...region, ...updates } : region
    ));
  }, []);

  const deleteRegion = useCallback((id: string) => {
    setRegions(prev => {
      // Remove the region
      const newRegions = prev.filter(region => region.id !== id);
      
      // Don't renumber existing regions to avoid confusion
      return newRegions;
    });
  }, []);

  const addMaterial = useCallback((material: Omit<Material, 'id'>) => {
    setMaterials(prev => [...prev, { ...material, id: Date.now().toString() }]);
  }, []);

  const updateMaterial = useCallback((id: string, updates: Partial<Material>) => {
    setMaterials(prev => prev.map(material => 
      material.id === id ? { ...material, ...updates } : material
    ));
  }, []);

  const deleteMaterial = useCallback((id: string) => {
    setMaterials(prev => prev.filter(material => material.id !== id));
    // Also update any regions using this material
    setRegions(prev => prev.map(region => 
      region.materialId === id ? { ...region, materialId: null } : region
    ));
  }, []);

  const saveProject = useCallback(() => {
    try {
      const projectData = {
        name: projectName,
        scale,
        scaleUnit,
        regions,
        materials,
      };
      
      // In a real app, we'd save to a file or localStorage
      // For demonstration, we'll just log and show some feedback
      console.log('Project data saved:', projectData);
      const json = JSON.stringify(projectData);
      
      // Save to localStorage for persistence
      localStorage.setItem('builderEstimationProject', json);
      
      // Create a download link for the JSON file
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${projectName || 'project'}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      return true;
    } catch (error) {
      console.error('Error saving project:', error);
      toast.error('Failed to save project');
      return false;
    }
  }, [projectName, scale, scaleUnit, regions, materials]);

  const loadProject = useCallback((data: any) => {
    try {
      setProjectName(data.name || 'Imported Project');
      setScale(data.scale || 1);
      setScaleUnit(data.scaleUnit || 'ft');
      
      // Ensure all regions have name property
      const updatedRegions = (data.regions || []).map((region: Region, index: number) => {
        if (!region.name) {
          return { ...region, name: `Region ${index + 1}` };
        }
        return region;
      });
      
      setRegions(updatedRegions);
      setMaterials(data.materials || []);
      toast.success('Project loaded successfully');
      return true;
    } catch (error) {
      console.error('Error loading project:', error);
      toast.error('Failed to load project');
      return false;
    }
  }, []);

  // Load last project from localStorage on initial render
  useEffect(() => {
    try {
      const savedProject = localStorage.getItem('builderEstimationProject');
      if (savedProject) {
        const projectData = JSON.parse(savedProject);
        loadProject(projectData);
      }
    } catch (error) {
      console.error('Error loading saved project:', error);
    }
  }, [loadProject]);

  return (
    <ProjectContext.Provider
      value={{
        pdf,
        pdfUrl,
        pageCount,
        currentPage,
        scale,
        scaleUnit,
        regions,
        materials,
        projectName,
        setProjectName,
        loadPdf,
        setCurrentPage,
        setScale,
        setScaleUnit,
        addRegion,
        updateRegion,
        deleteRegion,
        addMaterial,
        updateMaterial,
        deleteMaterial,
        saveProject,
        loadProject,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
};

export const useProject = () => {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error('useProject must be used within a ProjectProvider');
  }
  return context;
};
