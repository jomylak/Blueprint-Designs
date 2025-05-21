
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import BlueprintView from "@/components/BlueprintView";
import EstimationSummary from "@/components/EstimationSummary";
import MaterialLibrary from "@/components/MaterialLibrary";
import { ProjectProvider } from "@/context/ProjectContext";
import Header from "@/components/Header";
import { Toaster } from "sonner";

const Index = () => {
  return (
    <ProjectProvider>
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
              <BlueprintView />
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
    </ProjectProvider>
  );
};

export default Index;
