import { useProject } from "@/context/ProjectContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import {
  FolderOpen,
  Upload,
  FilePlus2,
  CloudUpload,
  LogIn,
  LogOut,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { isElectron, openBytesFromFile } from "@/lib/fileIO";
import { createCloudProject, updateCloudProject } from "@/lib/api";
import AuthDialog from "@/components/AuthDialog";

const Header = () => {
  const {
    loadPdf,
    projectName,
    saveProject,
    importProject,
    importProjectFromBytes,
    buildProjectData,
    cloudProjectId,
    setCloudProjectId,
  } = useProject();
  const { user, signOut } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [authOpen, setAuthOpen] = useState(false);
  const queryClient = useQueryClient();

  const saveToCloudMutation = useMutation({
    mutationFn: () => {
      const data = buildProjectData();
      return cloudProjectId
        ? updateCloudProject(cloudProjectId, projectName, data)
        : createCloudProject(projectName, data);
    },
    onSuccess: (project) => {
      setCloudProjectId(project.id);
      queryClient.invalidateQueries({ queryKey: ["cloud-projects"] });
      toast.success("Saved to cloud!");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const handleSaveToCloud = () => {
    if (!user) {
      setAuthOpen(true);
      return;
    }
    saveToCloudMutation.mutate();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      loadPdf(file);
      toast.success(`Loaded blueprint: ${file.name}`);
    }
  };

  const handleSave = () => {
    // saveProject() already shows its own success/error toast for both the native-dialog
    // (Electron) and local-storage (browser) paths.
    saveProject();
  };

  const handleImportClick = async () => {
    if (isElectron()) {
      const bytes = await openBytesFromFile(["json"]);
      if (bytes) importProjectFromBytes(bytes);
      return;
    }
    fileInputRef.current?.click();
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      importProject(file);
    }
    e.target.value = ""; // allow re-importing same file
  };

  return (
    <header className="bg-background border-b border-border">
      <div className="container mx-auto py-3 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 bg-primary rounded-md flex items-center justify-center">
            <Pencil className="h-4 w-4 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-semibold">Markyn</h1>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSave}
            className="flex items-center gap-1"
            disabled={!projectName}
          >
            <FolderOpen className="h-4 w-4" />
            <span>Save project</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportClick}
            className="flex items-center gap-1"
          >
            <Upload className="h-4 w-4" />
            <span>Import</span>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            style={{ display: "none" }}
            onChange={handleImportFile}
          />

          <Button
            variant="outline"
            size="sm"
            onClick={handleSaveToCloud}
            className="flex items-center gap-1"
            disabled={!projectName || saveToCloudMutation.isPending}
          >
            <CloudUpload className="h-4 w-4" />
            <span>{saveToCloudMutation.isPending ? "Saving..." : "Save to cloud"}</span>
          </Button>

          <Button
            variant="default"
            size="sm"
            onClick={() => document.getElementById('pdf-upload')?.click()}
            className="flex items-center gap-1"
          >
            <FilePlus2 className="h-4 w-4" />
            <span>New blueprint</span>
          </Button>
          <input
            id="pdf-upload"
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            className="hidden"
          />

          {user ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut()}
              className="flex items-center gap-1"
              title={user.email ?? undefined}
            >
              <LogOut className="h-4 w-4" />
              <span className="max-w-[120px] truncate">{user.email}</span>
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setAuthOpen(true)}
              className="flex items-center gap-1"
            >
              <LogIn className="h-4 w-4" />
              <span>Sign in</span>
            </Button>
          )}
        </div>
      </div>
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
    </header>
  );
};

export default Header;
