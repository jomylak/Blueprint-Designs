
import { useProject } from "@/context/ProjectContext";
import { Button } from "@/components/ui/button";
import { FileIcon, FolderIcon, Upload } from "lucide-react";
import { toast } from "sonner";

const Header = () => {
  const { loadPdf, projectName, saveProject } = useProject();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadPdf(file);
      toast.success(`Loaded blueprint: ${file.name}`);
    }
  };

  const handleSave = () => {
    saveProject();
    toast.success("Project saved successfully");
  };

  return (
    <header className="bg-card border-b border-border">
      <div className="container mx-auto py-3 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
            <span className="text-white font-bold text-sm">BE</span>
          </div>
          <h1 className="text-lg font-semibold">Builder Estimation</h1>
        </div>

        <div className="flex gap-2">
          <Button 
            variant="default" 
            size="sm"
            onClick={() => document.getElementById('pdf-upload')?.click()}
            className="flex items-center gap-1"
          >
            <Upload className="h-4 w-4" />
            <span>Add Blueprint</span>
          </Button>
          <input
            id="pdf-upload"
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            className="hidden"
          />
          
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            className="flex items-center gap-1"
            disabled={!projectName}
          >
            <FolderIcon className="h-4 w-4" />
            <span>Save Project</span>
          </Button>
        </div>
      </div>
    </header>
  );
};

export default Header;
