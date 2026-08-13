import React, { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowLeft,
  ArrowRight,
  Plus,
  MinusIcon,
  CheckIcon,
  TrashIcon
} from "lucide-react";
import { useProject } from "@/context/ProjectContext";
import { toast } from "sonner";
import RegionsList from "./RegionsList";
import { generateRandomColor, calculatePolygonArea } from "@/lib/utils";
import { useLocation } from "react-router-dom";
import { nanoid } from "nanoid";

pdfjs.GlobalWorkerOptions.workerSrc = `${import.meta.env.BASE_URL}pdf.worker.mjs`;

enum DrawingMode {
  None,
  Drawing,
  Scaling // <-- We'll use this for calibration mode
}

const BlueprintView = () => {
  const {
    pdfData,
    pageCount,
    setPageCount,
    currentPage,
    setCurrentPage,
    regions,
    addRegion,
    updateRegion,
    deleteRegion,
    scale,
    setScale,
  } = useProject();

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [pageAspectRatio, setPageAspectRatio] = useState<number | null>(null);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>(DrawingMode.None);
  const [currentPoints, setCurrentPoints] = useState<number[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [calibrationInput, setCalibrationInput] = useState("");
  const [calibrationUnit, setCalibrationUnit] = useState("ft");
  const [editingRegionId, setEditingRegionId] = useState<string | null>(null);
  const [editingPoints, setEditingPoints] = useState<number[] | null>(null);
  const [draggedPointIdx, setDraggedPointIdx] = useState<number | null>(null);
  // Live cursor position (zoom-independent, same basis as currentPoints) while drawing a
  // region or calibrating, used to render a rubber-band line to the last placed point.
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  // Only update container width on mount and window resize (height now follows the PDF's
  // own aspect ratio instead of a fixed/measured value, see renderedHeight below).
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.clientWidth);
      }
    };
    window.addEventListener("resize", updateDimensions);
    updateDimensions();
    return () => window.removeEventListener("resize", updateDimensions);
  }, []); // <-- Only run once on mount

  // Let Ctrl/Cmd + scroll wheel zoom in/out. React's onWheel is passive by default so it
  // can't preventDefault - a native listener is needed to stop the page from scrolling too.
  // A plain scroll (no modifier) still pans the container normally.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      setZoom(prev => Math.min(2, Math.max(0.5, prev - e.deltaY * 0.0015)));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

  // Only reset page when a new PDF is loaded (do not reset on tab switch)
  useEffect(() => {
    if (pdfData && currentPage === 0) {
      setCurrentPage(1);
    }
    setPageAspectRatio(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfData]);

  // Rendered size of the current page including zoom - used for the overlay SVG and the
  // scroll container so nothing is silently clipped, and so click coordinates map correctly.
  const renderedWidth = containerWidth * zoom;
  const renderedHeight = pageAspectRatio ? renderedWidth / pageAspectRatio : renderedWidth * 1.294;

  // Track and restore last viewed page when switching tabs
  useEffect(() => {
    // Save current page to localStorage on change
    localStorage.setItem("blueprint-last-page", String(currentPage));
  }, [currentPage]);

  useEffect(() => {
    // Restore last page if available (only on mount)
    const lastPage = Number(localStorage.getItem("blueprint-last-page"));
    if (lastPage && lastPage !== currentPage) {
      setCurrentPage(lastPage);
    }
    // eslint-disable-next-line
  }, []);

  // Unified SVG click handler for both region and calibration
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (drawingMode === DrawingMode.Scaling) {
      // Calibration mode: only allow two points
      if (currentPoints.length >= 4) return;
      const svg = e.currentTarget;
      if (!svg) return;
      if (typeof svg.createSVGPoint !== "function") return;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const cursorpt = pt.matrixTransform(ctm.inverse());
      // Store as a fraction of the rendered page width, independent of both zoom AND the
      // window/container size, so points stay aligned to the blueprint no matter what zoom
      // level or window size they were captured at; render layers multiply back by the
      // current renderedWidth to project to screen space.
      setCurrentPoints(prev => [...prev, cursorpt.x / renderedWidth, cursorpt.y / renderedWidth]);
      return;
    }
    if (drawingMode !== DrawingMode.Drawing) return;
    // Region drawing mode
    const svg = e.currentTarget;
    if (!svg) return;
    setCurrentPoints(prevPoints => {
      if (typeof svg.createSVGPoint !== "function") return prevPoints;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return prevPoints;
      const cursorpt = pt.matrixTransform(ctm.inverse());
      // See note above: fraction-of-width so regions don't drift with zoom or window size.
      return [...prevPoints, cursorpt.x / renderedWidth, cursorpt.y / renderedWidth];
    });
  };

  // Complete region drawing
  const completeRegionDrawing = () => {
    if (drawingMode === DrawingMode.Scaling) return; // Don't allow in calibration mode
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
      color: generateRandomColor(), // Always randomize color on create
    });
    setCurrentPoints([]);
    setDrawingMode(DrawingMode.None);
    setMousePos(null);
    toast.success("Region created successfully");
  };

  // Cancel drawing or calibration
  const cancelDrawing = () => {
    setCurrentPoints([]);
    setDrawingMode(DrawingMode.None);
    setCalibrationInput("");
    setCalibrationUnit("ft");
    setMousePos(null);
  };

  // Calibration helpers
  const getCalibrationPixelDistance = () => {
    if (currentPoints.length !== 4) return 0;
    const [x1, y1, x2, y2] = currentPoints;
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  };

  const handleCalibrationSave = () => {
    const pixelDist = getCalibrationPixelDistance();
    const realDist = parseFloat(calibrationInput);
    if (pixelDist === 0 || !realDist || realDist <= 0) {
      toast.error("Please select two points and enter a valid real-world distance.");
      return;
    }
    // Convert to feet for scale if needed
    let realDistInFeet = realDist;
    if (calibrationUnit === "in") realDistInFeet = realDist / 12;
    else if (calibrationUnit === "cm") realDistInFeet = realDist / 30.48;
    else if (calibrationUnit === "m") realDistInFeet = realDist * 3.28084;
    const newScale = pixelDist / realDistInFeet;
    setScale(newScale);
    setCurrentPoints([]);
    setDrawingMode(DrawingMode.None);
    setCalibrationInput("");
    setCalibrationUnit("ft");
    setMousePos(null);
    toast.success("Scale calibrated!");
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

  // Fix: setPageCount only when numPages is available, and don't reset pageCount to 0 in context
  // Fix: Memoize handleLoadSuccess with useCallback and use correct renderMode
  const handleLoadSuccess = useCallback(
    ({ numPages }: { numPages: number }) => {
      setPageCount(numPages);
    },
    [setPageCount]
  );

  // Keep the Document's `file` prop referentially stable so react-pdf doesn't re-parse the
  // whole PDF (and flash blank) on every zoom/page change - only when the bytes actually change.
  const pdfFile = useMemo(
    () => (pdfData ? { data: new Uint8Array(pdfData) } : undefined),
    [pdfData]
  );

  // Memoize the PDF Document/Page layer so it only re-renders when pdfData, currentPage, zoom, or container size changes
  const renderedPdf = useMemo(() => (
    <div
      style={{
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        background: "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        position: "absolute",
        left: 0,
        top: 0,
        zIndex: 1,
      }}
    >
      <Document
        file={pdfFile}
        onLoadSuccess={handleLoadSuccess}
        loading={<div>Loading PDF...</div>}
        error={<div>Failed to load PDF.</div>}
      >
        <Page
          pageNumber={currentPage}
          width={renderedWidth}
          renderAnnotationLayer={false}
          renderTextLayer={false}
          renderMode={"svg" as any}
          onLoadSuccess={(page: any) => setPageAspectRatio(page.width / page.height)}
        />
      </Document>
    </div>
  ), [pdfFile, currentPage, renderedWidth, handleLoadSuccess]);

  // Move these function declarations above renderedRegions so they are defined before use
  const handleRegionEdit = (regionId: string) => {
    const region = regions.find(r => r.id === regionId);
    if (region) {
      setEditingRegionId(regionId);
      setEditingPoints([...region.points]);
      setDrawingMode(DrawingMode.None);
    }
  };

  const handlePointMouseDown = (idx: number) => {
    setDraggedPointIdx(idx);
  };

  const handleSvgMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    if (typeof svg.createSVGPoint !== "function") return;

    if (editingRegionId && editingPoints && draggedPointIdx !== null) {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const cursorpt = pt.matrixTransform(ctm.inverse());
      const newPoints = [...editingPoints];
      // editingPoints (seeded from region.points) uses the same fraction-of-width basis.
      newPoints[draggedPointIdx] = cursorpt.x / renderedWidth;
      newPoints[draggedPointIdx + 1] = cursorpt.y / renderedWidth;
      setEditingPoints(newPoints);
      return;
    }

    if (drawingMode === DrawingMode.Drawing || drawingMode === DrawingMode.Scaling) {
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const ctm = svg.getScreenCTM();
      if (!ctm) return;
      const cursorpt = pt.matrixTransform(ctm.inverse());
      setMousePos({ x: cursorpt.x / renderedWidth, y: cursorpt.y / renderedWidth });
    }
  };

  const handleSvgMouseLeave = () => {
    setDraggedPointIdx(null);
    setMousePos(null);
  };

  const handleSvgMouseUp = () => {
    setDraggedPointIdx(null);
  };

  const handleSaveEditedRegion = () => {
    if (editingRegionId && editingPoints) {
      updateRegion(editingRegionId, { points: editingPoints });
      setEditingRegionId(null);
      setEditingPoints(null);
      setDraggedPointIdx(null);
      toast.success("Region points updated!");
    }
  };

  const handleCancelEdit = () => {
    setEditingRegionId(null);
    setEditingPoints(null);
    setDraggedPointIdx(null);
  };

  // Memoize region polygons, with edit handles if editing
  const renderedRegions = useMemo(() => (
    pageRegions.map((region) => {
      const isEditing = editingRegionId === region.id;
      const pointsToRender = isEditing && editingPoints ? editingPoints : region.points;
      return (
        <g key={region.id}>
          <polygon
            points={pointsToRender.map((p, i) =>
              i % 2 === 0
                ? `${pointsToRender[i] * renderedWidth},${pointsToRender[i + 1] * renderedWidth}`
                : null
            ).filter(Boolean).join(" ")}
            fill={region.color + "80"}
            stroke={selectedRegionId === region.id ? "#3b82f6" : region.color}
            strokeWidth={isEditing ? 1 : selectedRegionId === region.id ? 2 : 1}
            opacity={isEditing ? 0.5 : 1}
            onClick={e => {
              e.stopPropagation();
              setSelectedRegionId(region.id);
              // Start editing on double click
              if (e.detail === 2) handleRegionEdit(region.id);
            }}
            style={{ cursor: isEditing ? "move" : "pointer" }}
          />
          {/* Render draggable points if editing */}
          {isEditing && pointsToRender.length >= 2 && Array.from({ length: pointsToRender.length / 2 }).map((_, i) => (
            <circle
              key={i}
              cx={pointsToRender[i * 2] * renderedWidth}
              cy={pointsToRender[i * 2 + 1] * renderedWidth}
              r={1}
              fill="#3b82f6"
              opacity={0.5}
              stroke="#fff"
              strokeWidth={0.7}
              style={{ cursor: "pointer" }}
              onMouseDown={e => {
                e.stopPropagation();
                handlePointMouseDown(i * 2);
              }}
            />
          ))}
        </g>
      );
    })
  ), [pageRegions, renderedWidth, selectedRegionId, editingRegionId, editingPoints]);

  // Memoize current drawing polyline and points
  const renderedDrawing = useMemo(() => (
    drawingMode === DrawingMode.Drawing && currentPoints.length > 0 ? (
      <>
        <polyline
          // Thinner, more transparent line for accuracy
          points={currentPoints.map((p, i) =>
            i % 2 === 0
              ? `${currentPoints[i] * renderedWidth},${currentPoints[i + 1] * renderedWidth}`
              : null
          ).filter(Boolean).join(" ")}
          fill="none"
          stroke="#3b82f6"
          strokeWidth={1}
          strokeDasharray="3,3"
          opacity={0.7}
        />
        {/* Rubber-band line from the last placed point to the cursor, to help line up the next click */}
        {mousePos && (
          <line
            x1={currentPoints[currentPoints.length - 2] * renderedWidth}
            y1={currentPoints[currentPoints.length - 1] * renderedWidth}
            x2={mousePos.x * renderedWidth}
            y2={mousePos.y * renderedWidth}
            stroke="#3b82f6"
            strokeWidth={1}
            strokeDasharray="3,3"
            opacity={0.5}
          />
        )}
        {Array.from({ length: currentPoints.length / 2 }).map((_, i) => (
          <circle
            key={i}
            cx={currentPoints[i * 2] * renderedWidth}
            cy={currentPoints[i * 2 + 1] * renderedWidth}
            r={2.5}
            fill="#3b82f6"
            opacity={0.6}
            stroke="#fff"
            strokeWidth={0.7}
          />
        ))}
      </>
    ) : null
  ), [drawingMode, currentPoints, renderedWidth, mousePos]);

  // Memoize calibration line/points for overlay
  const renderedCalibration = useMemo(() => (
    drawingMode === DrawingMode.Scaling && currentPoints.length >= 2 ? (
      <>
        {currentPoints.length === 4 && (
          <line
            x1={currentPoints[0] * renderedWidth}
            y1={currentPoints[1] * renderedWidth}
            x2={currentPoints[2] * renderedWidth}
            y2={currentPoints[3] * renderedWidth}
            stroke="#f59e42"
            strokeWidth={1}
            opacity={0.7}
          />
        )}
        {/* Rubber-band line to the cursor while placing the second calibration point */}
        {currentPoints.length === 2 && mousePos && (
          <line
            x1={currentPoints[0] * renderedWidth}
            y1={currentPoints[1] * renderedWidth}
            x2={mousePos.x * renderedWidth}
            y2={mousePos.y * renderedWidth}
            stroke="#f59e42"
            strokeWidth={1}
            strokeDasharray="3,3"
            opacity={0.5}
          />
        )}
        <circle
          cx={currentPoints[0] * renderedWidth}
          cy={currentPoints[1] * renderedWidth}
          r={2.5}
          fill="#f59e42"
          opacity={0.6}
          stroke="#fff"
          strokeWidth={0.7}
        />
        {currentPoints.length === 4 && (
          <circle
            cx={currentPoints[2] * renderedWidth}
            cy={currentPoints[3] * renderedWidth}
            r={2.5}
            fill="#f59e42"
            opacity={0.6}
            stroke="#fff"
            strokeWidth={0.7}
          />
        )}
      </>
    ) : null
  ), [drawingMode, currentPoints, renderedWidth, mousePos]);

  return (
    <div className="flex flex-col gap-4 h-full">
      {/* Page navigation and drawing controls */}
      {pdfData && (
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
            <span className="text-xs text-muted-foreground hidden lg:inline">
              (Ctrl/Cmd + scroll to zoom)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={drawingMode === DrawingMode.Scaling ? "secondary" : "outline"}
              size="sm"
              onClick={() => {
                setDrawingMode(DrawingMode.Scaling);
                setCurrentPoints([]);
                setCalibrationInput("");
                setCalibrationUnit("ft");
              }}
            >
              Calibrate Scale
            </Button>
            {drawingMode === DrawingMode.Scaling && (
              <div className="flex items-center gap-2 ml-2">
                <input
                  type="number"
                  className="border px-2 py-1 rounded w-20 text-black bg-white"
                  placeholder="Length"
                  value={calibrationInput}
                  onChange={e => setCalibrationInput(e.target.value)}
                  style={{ color: "#000", background: "#fff" }}
                />
                <select
                  className="border px-1 py-1 rounded text-black bg-white"
                  value={calibrationUnit}
                  onChange={e => setCalibrationUnit(e.target.value)}
                  style={{ color: "#000", background: "#fff" }}
                >
                  <option value="ft">ft</option>
                  <option value="in">in</option>
                  <option value="m">m</option>
                  <option value="cm">cm</option>
                </select>
                <Button size="sm" onClick={handleCalibrationSave} disabled={currentPoints.length !== 4 || !calibrationInput}>
                  Set Scale
                </Button>
                <Button size="sm" variant="ghost" onClick={cancelDrawing}>
                  Cancel
                </Button>
              </div>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDrawingMode(DrawingMode.Drawing)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Draw Region
            </Button>
            {/* Show Complete/Cancel buttons when drawing a region */}
            {drawingMode === DrawingMode.Drawing && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={completeRegionDrawing}
                  disabled={currentPoints.length < 6}
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
            )}
          </div>
        </div>
      )}
      {/* Show Save/Cancel when editing region points at the top of the PDF window */}
      {editingRegionId && (
        <div className="flex gap-2 mb-2 justify-center">
          <Button size="sm" variant="outline" onClick={handleSaveEditedRegion}>
            Save Region Points
          </Button>
          <Button size="sm" variant="ghost" onClick={handleCancelEdit}>
            Cancel
          </Button>
        </div>
      )}
      {/* PDF and Drawing Overlay */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="md:col-span-3">
          <CardContent className="p-4">
            <div
              ref={containerRef}
              className="relative border border-border rounded-md overflow-auto w-full"
              style={{ minHeight: 400, maxHeight: "75vh" }}
            >
              {pdfData ? (
                <div
                  style={{
                    width: renderedWidth,
                    height: renderedHeight,
                    position: "relative",
                    margin: "0 auto",
                  }}
                >
                  {/* PDF Layer (memoized, only re-renders on page/zoom/size change) */}
                  {renderedPdf}
                  {/* SVG Overlay */}
                  <svg
                    width={renderedWidth}
                    height={renderedHeight}
                    style={{
                      position: "absolute",
                      left: 0,
                      top: 0,
                      zIndex: 2,
                      pointerEvents: "auto",
                    }}
                    onClick={handleSvgClick}
                    onMouseMove={handleSvgMouseMove}
                    onMouseUp={handleSvgMouseUp}
                    onMouseLeave={handleSvgMouseLeave}
                  >
                    {renderedRegions}
                    {renderedDrawing}
                    {renderedCalibration}
                  </svg>
                </div>
              ) : (
                <div className="flex items-center justify-center h-[400px] bg-muted">
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
              editingRegionId={editingRegionId}
              onSaveEdit={handleSaveEditedRegion}
              onCancelEdit={handleCancelEdit}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BlueprintView;
