import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BlueprintView from "@/components/BlueprintView";
import EstimationSummary from "@/components/EstimationSummary";
import MaterialLibrary from "@/components/MaterialLibrary";
import SavedProjects from "@/components/SavedProjects";
import Header from "@/components/Header";
import { Toaster } from "sonner";
import { useProject } from "@/context/ProjectContext";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useState, useRef } from "react";

// Blueprint placeholder component when no PDF is loaded
const BlueprintPlaceholder = () => {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] bg-muted/20 rounded-lg border border-dashed border-muted">
      <Upload className="h-10 w-10 text-muted-foreground mb-4" />
      <h3 className="text-lg font-medium mb-2">No Blueprint Loaded</h3>
      <p className="text-muted-foreground text-sm mb-4">Upload a PDF blueprint to get started</p>
      <Button 
        onClick={() => document.getElementById('pdf-upload')?.click()}
        className="flex items-center gap-2"
      >
        <Upload className="h-4 w-4" />
        Add Blueprint PDF
      </Button>
    </div>
  );
};

// Wrapper component for BlueprintView that conditionally renders the placeholder
const BlueprintViewWrapper = () => {
  const { pdfData } = useProject(); // <-- use pdfData, not pdfUrl

  if (!pdfData) {
    return <BlueprintPlaceholder />;
  }

  return <BlueprintView />;
};

const Index = () => {
  const { regions, currentPage } = useProject();
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);

  // Show only regions for the current page
  const pageRegions = regions.filter(r => r.pageNumber === currentPage);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto py-4 px-2 md:px-6">
        <Tabs defaultValue="blueprint" className="w-full">
          <TabsList className="grid grid-cols-3 mb-6">
            <TabsTrigger value="blueprint">Blueprint View</TabsTrigger>
            <TabsTrigger value="estimation">Estimation Summary</TabsTrigger>
            <TabsTrigger value="materials">Material Library</TabsTrigger>
          </TabsList>
          <TabsContent value="blueprint">
            <div className="flex gap-6 h-full">
              <div className="flex-1 min-w-0">
                <BlueprintViewWrapper />
              </div>
            </div>
          </TabsContent>
          <TabsContent value="estimation">
            <EstimationSummary />
          </TabsContent>
          <TabsContent value="materials">
            <MaterialLibrary />
          </TabsContent>
        </Tabs>
      </main>
      <Toaster position="top-right" />
    </div>
  );
};

export default Index;
