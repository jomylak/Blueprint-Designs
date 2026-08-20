import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BlueprintView from "@/components/BlueprintView";
import EstimationSummary from "@/components/EstimationSummary";
import MaterialLibrary from "@/components/MaterialLibrary";
import SavedProjects from "@/components/SavedProjects";
import CloudProjects from "@/components/CloudProjects";
import Header from "@/components/Header";
import { useProject } from "@/context/ProjectContext";
import { Button } from "@/components/ui/button";
import { FilePlus2 } from "lucide-react";
import { useState, useRef } from "react";

// Blueprint placeholder component when no PDF is loaded
const BlueprintPlaceholder = () => {
  return (
    <div className="grid-lines-bg flex flex-col items-center justify-center h-[60vh] rounded-2xl border border-dashed border-border">
      <div className="w-14 h-14 rounded-xl border border-border bg-secondary flex items-center justify-center mb-5">
        <FilePlus2 className="h-6 w-6 text-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-2">Start your first blueprint</h3>
      <p className="text-muted-foreground text-sm mb-5 text-center max-w-xs">
        Upload a PDF to set scale, trace rooms, and price the job as you go.
      </p>
      <Button
        onClick={() => document.getElementById('pdf-upload')?.click()}
        className="flex items-center gap-2"
      >
        <FilePlus2 className="h-4 w-4" />
        New blueprint
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
      <Tabs defaultValue="blueprint" className="w-full flex-1 flex flex-col">
        <div className="border-b border-border px-2 md:px-4">
          <TabsList className="container mx-auto justify-start h-auto py-2">
            <TabsTrigger value="blueprint">Blueprint view</TabsTrigger>
            <TabsTrigger value="estimation">Estimate summary</TabsTrigger>
            <TabsTrigger value="materials">Material library</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
          </TabsList>
        </div>
        <main className="flex-1 w-full py-4 px-2 md:px-4">
          <TabsContent value="blueprint" forceMount className="data-[state=inactive]:hidden mt-0">
            <BlueprintViewWrapper />
          </TabsContent>
          <TabsContent value="estimation" forceMount className="data-[state=inactive]:hidden mt-0 max-w-5xl mx-auto">
            <EstimationSummary />
          </TabsContent>
          <TabsContent value="materials" forceMount className="data-[state=inactive]:hidden mt-0 max-w-3xl mx-auto">
            <MaterialLibrary />
          </TabsContent>
          <TabsContent value="projects" forceMount className="data-[state=inactive]:hidden mt-0 max-w-5xl mx-auto space-y-8">
            <SavedProjects />
            <CloudProjects />
          </TabsContent>
        </main>
      </Tabs>
    </div>
  );
};

export default Index;
