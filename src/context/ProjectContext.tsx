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
  pdfData: Uint8Array | null;
  loadPdf: (file: File) => Promise<void>;
  pageCount: number;
  setPageCount: (count: number) => void; // <-- Add this
  currentPage: number;
  setCurrentPage: (page: number) => void;
  scale: number;
  setScale: (scale: number) => void;
  scaleUnit: string;
  setScaleUnit: (unit: string) => void;
  regions: Region[];
  materials: Material[];
  projectName: string;
  setProjectName: (name: string) => void;
  addRegion: (region: Omit<Region, 'id' | 'name'>) => void;
  updateRegion: (id: string, updates: Partial<Region>) => void;
  deleteRegion: (id: string) => void;
  addMaterial: (material: Omit<Material, 'id'>) => void;
  updateMaterial: (id: string, updates: Partial<Material>) => void;
  deleteMaterial: (id: string) => void;
  saveProject: () => void;
  loadProject: (data: any) => void;
  importProject: (file: File) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider = ({ children }: { children: React.ReactNode }) => {
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
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

  // Only set the PDF data and reset state
  const loadPdf = async (file: File) => {
    const arrayBuffer = await file.arrayBuffer();
    const uint8 = new Uint8Array(arrayBuffer);
    setPdfData(new Uint8Array(uint8));
    console.log("pdfData set in context:", uint8.byteLength);
    setProjectName(file.name.replace('.pdf', ''));
    setRegions([]);
    setMaterials([
      { id: '1', name: 'Ceramic Tile', pricePerSqFt: 5.99 },
      { id: '2', name: 'Hardwood', pricePerSqFt: 8.50 },
      { id: '3', name: 'Carpet', pricePerSqFt: 3.75 },
      { id: '4', name: 'Vinyl', pricePerSqFt: 2.99 },
    ]);
    setScale(1);
    setScaleUnit('ft');
    setCurrentPage(1);
    setPageCount(0); // Will be set by BlueprintView when PDF loads
  };

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

  // Calculate the total cost of all regions
  const calculateTotalCost = useCallback(() => {
    return regions.reduce((total, region) => {
      if (region.materialId) {
        const material = materials.find(m => m.id === region.materialId);
        if (material) {
          return total + (material.pricePerSqFt * region.area);
        }
      }
      return total;
    }, 0);
  }, [regions, materials]);

  // Helper functions for PDF <-> base64
  function uint8ToBase64(uint8: Uint8Array) {
    // Use chunked conversion to avoid call stack overflow for large PDFs
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < uint8.length; i += chunkSize) {
      binary += String.fromCharCode.apply(
        null,
        uint8.subarray(i, i + chunkSize) as any
      );
    }
    return btoa(binary);
  }
  function base64ToUint8(base64: string) {
    const binary = atob(base64);
    const uint8 = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) uint8[i] = binary.charCodeAt(i);
    return uint8;
  }

  const saveProject = useCallback(() => {
    try {
      // Convert pdfData to base64 for storage
      const pdfBase64 = pdfData ? uint8ToBase64(pdfData) : null;
      const projectData = {
        name: projectName,
        scale,
        scaleUnit,
        regions,
        materials,
        pageCount,
        pdfBase64,
      };

      // Estimate size (in bytes) of the project data
      const estimateSize = (obj: any) => {
        try {
          return new Blob([JSON.stringify(obj)]).size;
        } catch {
          return 0;
        }
      };

      // Save to localStorage (as a list of projects)
      const projectsJson = localStorage.getItem('builderEstimationProjects');
      let projects = [];
      try {
        projects = projectsJson ? JSON.parse(projectsJson) : [];
      } catch (e) {
        projects = [];
      }
      const existingIndex = projects.findIndex((p: any) => p.name === projectName);
      const projectId = existingIndex >= 0 ? projects[existingIndex].id : Date.now().toString();

      const savedProject = {
        id: projectId,
        name: projectName,
        date: new Date().toLocaleDateString(),
        data: projectData
      };

      // Check if the new project will exceed localStorage quota (~5MB)
      const testProjects = [...projects];
      if (existingIndex >= 0) {
        testProjects[existingIndex] = savedProject;
      } else {
        testProjects.push(savedProject);
      }
      const estimatedSize = estimateSize(testProjects);

      // 5MB = 5 * 1024 * 1024 = 5242880 bytes (most browsers)
      if (estimatedSize > 5 * 1024 * 1024) {
        // Offer user to download the project as a file instead
        toast.error('Project is too large for browser storage. Downloading as file instead.');
        const blob = new Blob([JSON.stringify(savedProject)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${projectName || 'project'}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return false;
      }

      if (existingIndex >= 0) {
        projects[existingIndex] = savedProject;
      } else {
        projects.push(savedProject);
      }
      localStorage.setItem('builderEstimationProjects', JSON.stringify(projects));
      toast.success('Project saved!');
      return true;
    } catch (error) {
      console.error('Error saving project:', error);
      toast.error('Failed to save project. Your browser storage may be full.');
      return false;
    }
  }, [pdfData, projectName, scale, scaleUnit, regions, materials, pageCount]);

  const loadProject = useCallback((data: any) => {
    try {
      setProjectName(data.name || 'Imported Project');
      setScale(data.scale || 1);
      setScaleUnit(data.scaleUnit || 'ft');
      setPageCount(data.pageCount || 0);
      setRegions((data.regions || []).map((region: Region, idx: number) =>
        region.name ? region : { ...region, name: `Region ${idx + 1}` }
      ));
      setMaterials(data.materials || []);
      setCurrentPage(1);
      // Restore PDF from base64
      if (data.pdfBase64) {
        // SAFETY: Wait for setPdfData to finish before rendering PDF
        setPdfData(base64ToUint8(data.pdfBase64));
      } else {
        setPdfData(null);
      }
      // Wait for PDF to be set before rendering (prevents sendWithPromise error)
      setTimeout(() => {
        toast.success('Project loaded successfully');
      }, 100);
      return true;
    } catch (error) {
      console.error('Error loading project:', error);
      toast.error('Failed to load project');
      return false;
    }
  }, [setProjectName, setScale, setScaleUnit, setPageCount, setRegions, setMaterials, setCurrentPage, setPdfData]);

  // Import project from JSON file
  const importProject = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const imported = JSON.parse(text);
        // Accept both single project and wrapped {data: ...} format
        const projectData = imported.data || imported;
        loadProject(projectData);
        toast.success('Project imported successfully!');
      } catch (error) {
        toast.error('Failed to import project: Invalid file.');
      }
    };
    reader.readAsText(file);
  }, [loadProject]);

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
        pdfData,
        loadPdf,
        pageCount,
        setPageCount, // <-- Add this
        currentPage,
        setCurrentPage,
        scale,
        setScale,
        scaleUnit,
        setScaleUnit,
        regions,
        materials,
        projectName,
        setProjectName,
        addRegion,
        updateRegion,
        deleteRegion,
        addMaterial,
        updateMaterial,
        deleteMaterial,
        saveProject,
        loadProject,
        importProject, // <-- add to context
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
