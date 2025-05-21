import { useRef, useState, useEffect } from "react";
import { useProject } from "@/context/ProjectContext";
import { Stage, Layer, Line, Circle } from "react-konva";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ArrowLeft, 
  ArrowRight, 
  CheckIcon,
  Plus,
  MinusIcon, 
  TrashIcon
} from "lucide-react";
import { toast } from "sonner";
import ScaleCalibrationTool from "./ScaleCalibrationTool";
import RegionsList from "./RegionsList";
import { generateRandomColor } from "@/lib/utils";

// Placeholder for PDF rendering
// In a real app, we would use pdfjs-dist to render each page
const mockPdfRendering = (pageNumber: number, width: number) => {
  return {
    width,
    height: width * 1.414, // A4 proportion
  };
};

enum DrawingMode {
  None,
  Drawing,
  Scaling
}

const BlueprintView = () => {
  const {
    pdfUrl,
    pageCount,
    currentPage,
    setCurrentPage,
    regions,
    addRegion,
    updateRegion,
    deleteRegion,
    scale,
  } = useProject();

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [containerHeight, setContainerHeight] = useState(600);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>(DrawingMode.None);
  const [currentPoints, setCurrentPoints] = useState<number[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  // Update container dimensions when the window resizes
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
        setContainerHeight(window.innerHeight * 0.7);
      }
    };

    updateDimensions();
    window.addEventListener("resize", updateDimensions);
    return () => window.removeEventListener("resize", updateDimensions);
  }, []);

  // Get PDF dimensions (in a real app, this would come from the PDF)
  const pdfDimensions = mockPdfRendering(currentPage, containerWidth);

  // Handle region drawing
  const handleStageClick = (e: any) => {
    if (drawingMode !== DrawingMode.Drawing) return;

    const stage = e.target.getStage();
    const pointerPosition = stage.getPointerPosition();
    
    if (!pointerPosition) return;
    
    const { x, y } = pointerPosition;
    setCurrentPoints([...currentPoints, x, y]);
  };

  const completeRegionDrawing = () => {
    if (currentPoints.length < 6) {
      toast.error("Please draw at least 3 points to create a region");
      return;
    }

    // Calculate area in square pixels
    const pixelArea = calculatePolygonArea(currentPoints);
    
    // Convert to square feet based on scale
    const realWorldArea = pixelArea / (scale * scale);
    
    addRegion({
      pageNumber: currentPage,
      points: [...currentPoints],
      materialId: null,
      area: parseFloat(realWorldArea.toFixed(2)),
      color: generateRandomColor(),
    });

    setCurrentPoints([]);
    setDrawingMode(DrawingMode.None);
    toast.success("Region created successfully");
  };

  const cancelDrawing = () => {
    setCurrentPoints([]);
    setDrawingMode(DrawingMode.None);
  };

  const calculatePolygonArea = (points: number[]): number => {
    let area = 0;
    const numPoints = points.length / 2;
    
    for (let i = 0, j = numPoints - 1; i < numPoints; j = i++) {
      const x1 = points[i * 2];
      const y1 = points[i * 2 + 1];
      const x2 = points[j * 2];
      const y2 = points[j * 2 + 1];
      area += x1 * y2;
      area -= y1 * x2;
    }
    
    area = Math.abs(area) / 2;
    return area;
  };

  const handleDeleteRegion = (id: string) => {
    deleteRegion(id);
    setSelectedRegionId(null);
    toast.success("Region deleted");
  };

  const navigateToPage = (direction: 'next' | 'prev') => {
    if (direction === 'next' && currentPage < pageCount) {
      setCurrentPage(currentPage + 1);
    } else if (direction === 'prev' && currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  const pageRegions = regions.filter(r => r.pageNumber === currentPage);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage <= 1}
            onClick={() => navigateToPage('prev')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          
          <span className="text-sm">
            Page {currentPage} of {pageCount}
          </span>
          
          <Button
            variant="outline"
            size="sm"
            disabled={currentPage >= pageCount}
            onClick={() => navigateToPage('next')}
          >
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom(prev => Math.max(0.5, prev - 0.1))}
          >
            <MinusIcon className="h-4 w-4" />
          </Button>
          <span className="text-sm w-16 text-center">{Math.round(zoom * 100)}%</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setZoom(prev => Math.min(2, prev + 0.1))}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-2">
          <ScaleCalibrationTool />
          
          {drawingMode === DrawingMode.Drawing ? (
            <>
              <Button 
                variant="outline"
                size="sm"
                onClick={completeRegionDrawing}
              >
                <CheckIcon className="h-4 w-4 mr-1" />
                Complete Region
              </Button>
              <Button 
                variant="ghost"
                size="sm"
                onClick={cancelDrawing}
              >
                Cancel
              </Button>
            </>
          ) : (
            <Button
              variant={drawingMode === DrawingMode.Drawing ? "secondary" : "outline"}
              size="sm"
              onClick={() => setDrawingMode(DrawingMode.Drawing)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Draw Region
            </Button>
          )}
        </div>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="md:col-span-3">
          <CardContent className="p-4">
            <div 
              ref={containerRef} 
              className="relative border border-border rounded-md overflow-hidden"
              style={{ height: `${containerHeight}px` }}
            >
              {pdfUrl ? (
                <Stage
                  width={containerWidth}
                  height={containerHeight}
                  onClick={handleStageClick}
                  className={drawingMode === DrawingMode.Drawing ? "drawing-cursor" : ""}
                  scale={{ x: zoom, y: zoom }}
                  draggable={drawingMode === DrawingMode.None}
                >
                  <Layer>
                    {/* Background placeholder */}
                    <Line
                      points={[0, 0, pdfDimensions.width, 0, pdfDimensions.width, pdfDimensions.height, 0, pdfDimensions.height]}
                      closed
                      fill="#f0f0f0"
                    />
                    
                    {/* Existing regions */}
                    {pageRegions.map((region) => (
                      <Line
                        key={region.id}
                        points={region.points}
                        closed
                        fill={region.color + "80"}
                        stroke={selectedRegionId === region.id ? "#3b82f6" : region.color}
                        strokeWidth={selectedRegionId === region.id ? 2 : 1}
                        onClick={() => setSelectedRegionId(region.id)}
                        className="region"
                      />
                    ))}
                    
                    {/* Currently drawing region */}
                    {currentPoints.length > 0 && (
                      <Line
                        points={currentPoints}
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dash={[5, 5]}
                      />
                    )}
                    
                    {/* Points for the current drawing */}
                    {currentPoints.length > 0 &&
                      Array.from({ length: currentPoints.length / 2 }).map((_, i) => (
                        <Circle
                          key={i}
                          x={currentPoints[i * 2]}
                          y={currentPoints[i * 2 + 1]}
                          radius={4}
                          fill="#3b82f6"
                        />
                      ))}
                  </Layer>
                </Stage>
              ) : (
                <div className="flex items-center justify-center h-full bg-muted">
                  <p className="text-muted-foreground">
                    Upload a blueprint PDF to get started
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <h3 className="font-medium mb-3">Regions on Page {currentPage}</h3>
            <RegionsList 
              regions={pageRegions} 
              selectedId={selectedRegionId} 
              onSelect={setSelectedRegionId} 
              onDelete={handleDeleteRegion} 
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BlueprintView;
