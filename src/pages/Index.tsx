
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BlueprintView from "@/components/BlueprintView";
import EstimationSummary from "@/components/EstimationSummary";
import MaterialLibrary from "@/components/MaterialLibrary";
import SavedProjects from "@/components/SavedProjects";
import { ProjectProvider } from "@/context/ProjectContext";
import Header from "@/components/Header";
import { Toaster } from "sonner";
import { useProject } from "@/context/ProjectContext";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";

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
  const { pdfUrl } = useProject();
  
  if (!pdfUrl) {
    return <BlueprintPlaceholder />;
  }
  
  return <BlueprintView />;
};

const Index = () => {
  return (
    <ProjectProvider>
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        <Header />
        <main className="flex-1 container mx-auto py-4 px-2 md:px-6">
          <Tabs defaultValue="blueprint" className="w-full">
            <TabsList className="grid grid-cols-4 mb-6">
              <TabsTrigger value="blueprint">Blueprint View</TabsTrigger>
              <TabsTrigger value="estimation">Estimation Summary</TabsTrigger>
              <TabsTrigger value="materials">Material Library</TabsTrigger>
              <TabsTrigger value="saved">Previous Projects</TabsTrigger>
            </TabsList>
            <TabsContent value="blueprint">
              <BlueprintViewWrapper />
            </TabsContent>
            <TabsContent value="estimation">
              <EstimationSummary />
            </TabsContent>
            <TabsContent value="materials">
              <MaterialLibrary />
            </TabsContent>
            <TabsContent value="saved">
              <SavedProjects />
            </TabsContent>
          </Tabs>
        </main>
        <Toaster position="top-right" />
      </div>
    </ProjectProvider>
  );
};

export default Index;
