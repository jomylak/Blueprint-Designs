import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useProject } from "@/context/ProjectContext";
import { useAuth } from "@/context/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { CloudIcon, TrashIcon, Edit, LogIn } from "lucide-react";
import AuthDialog from "@/components/AuthDialog";
import {
  listCloudProjects,
  getCloudProject,
  deleteCloudProject,
  type CloudProjectSummary,
} from "@/lib/api";

const CloudProjects = () => {
  const { user } = useAuth();
  const { loadProject, setCloudProjectId } = useProject();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [authOpen, setAuthOpen] = useState(false);

  const { data: projects = [], isLoading, isError } = useQuery({
    queryKey: ["cloud-projects"],
    queryFn: listCloudProjects,
    enabled: !!user,
  });

  const openMutation = useMutation({
    mutationFn: (id: string) => getCloudProject(id),
    onSuccess: (project) => {
      loadProject(project.data);
      setCloudProjectId(project.id);
      toast.success(`Loaded project: ${project.name}`);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCloudProject(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cloud-projects"] });
      toast.success("Cloud project deleted");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const filteredProjects = searchTerm
    ? projects.filter((p) => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
    : projects;

  return (
    <div className="space-y-4">
      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} />
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-semibold">Cloud Projects</h2>
        {user && (
          <Input
            placeholder="Search projects..."
            className="max-w-xs"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        )}
      </div>

      {!user && (
        <div className="text-center py-12 border rounded-lg bg-muted/20">
          <CloudIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">Sign in to see your cloud projects</h3>
          <p className="text-muted-foreground mb-4">
            Save projects to the cloud to access them from any device.
          </p>
          <Button onClick={() => setAuthOpen(true)}>
            <LogIn className="h-4 w-4 mr-2" />
            Sign In
          </Button>
        </div>
      )}

      {user && isLoading && (
        <div className="text-center py-12 text-muted-foreground">Loading cloud projects...</div>
      )}

      {user && isError && (
        <div className="text-center py-12 text-muted-foreground">
          Couldn't reach the cloud API. It may be waking up - try again in a moment.
        </div>
      )}

      {user && !isLoading && !isError && filteredProjects.length === 0 && (
        <div className="text-center py-12 border rounded-lg bg-muted/20">
          <CloudIcon className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">No Cloud Projects</h3>
          <p className="text-muted-foreground mb-4">
            {searchTerm ? "No projects match your search" : "Use \"Save to Cloud\" in the header to see it here"}
          </p>
        </div>
      )}

      {user && filteredProjects.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project: CloudProjectSummary) => (
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
                      onClick={() => deleteMutation.mutate(project.id)}
                      className="h-8 w-8 -mt-1 -mr-1"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(project.updated_at).toLocaleDateString()}
                  </p>
                </div>
                <div className="p-4 space-y-2">
                  <div className="grid grid-cols-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Regions</p>
                      <p className="font-medium">{project.regions_count}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Materials</p>
                      <p className="font-medium">{project.materials_count}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Est. Cost</p>
                      <p className="font-medium">${project.total_cost.toFixed(2)}</p>
                    </div>
                  </div>

                  <Button
                    onClick={() => openMutation.mutate(project.id)}
                    className="w-full mt-2"
                    disabled={openMutation.isPending}
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    Open Project
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default CloudProjects;
