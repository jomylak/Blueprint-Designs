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
} from "lucide-react";
import { useProject } from "@/context/ProjectContext";
import { toast } from "sonner";
import RegionsList from "./RegionsList";
import {
  generateRandomColor,
  calculatePolygonArea,
  computeEdgeLabels,
  computeRegionNameLabel,
  displayUnitToFeet,
  feetToDisplayUnit,
  segmentCrossesPolyline,
} from "@/lib/utils";

pdfjs.GlobalWorkerOptions.workerSrc = `${import.meta.env.BASE_URL}pdf.worker.mjs`;

enum DrawingMode {
  None,
  Drawing,
  Scaling // <-- We'll use this for calibration mode
}

const ZOOM_MIN = 0.5;
const ZOOM_MAX = 10;
// Screen-pixel radius (roughly zoom-independent - see handleSvgMouseMove) within which hovering
// near the shape's start point snaps/closes it instead of placing a new point there.
const SNAP_RADIUS_PX = 6;

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
    scaleUnit,
    setScaleUnit,
  } = useProject();

  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(800);
  const [containerHeight, setContainerHeight] = useState(500);
  const [pageAspectRatio, setPageAspectRatio] = useState<number | null>(null);
  const [drawingMode, setDrawingMode] = useState<DrawingMode>(DrawingMode.None);
  const [currentPoints, setCurrentPoints] = useState<number[]>([]);
  const [selectedRegionId, setSelectedRegionId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  // Canvas pan offset (in screen px) applied to the content layer, like a whiteboard app -
  // lets the user drag the page around, especially useful when zoomed in past the viewport.
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStartRef = useRef<{ mouseX: number; mouseY: number; panX: number; panY: number; w: number; h: number } | null>(null);
  const [calibrationInput, setCalibrationInput] = useState("");
  // Feet calibration is entered as separate feet + inches boxes (common for blueprint
  // dimensions like 10ft 6in); other units use the single calibrationInput box above.
  const [calibrationFeet, setCalibrationFeet] = useState("");
  const [calibrationInches, setCalibrationInches] = useState("");
  const [calibrationUnit, setCalibrationUnit] = useState("ft");
  const [editingRegionId, setEditingRegionId] = useState<string | null>(null);
  const [editingPoints, setEditingPoints] = useState<number[] | null>(null);
  const [draggedPointIdx, setDraggedPointIdx] = useState<number | null>(null);
  // Live cursor position (zoom-independent, same basis as currentPoints) while drawing a
  // region or calibrating, used to render a rubber-band line to the last placed point.
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);
  // Which edge's length label (of the region currently being edited) has an inline correction
  // input open - lets the user type an exact measurement to fix a hand-drawn edge that's a bit
  // off, rather than fighting the mouse for pixel-perfect precision.
  const [edgeLengthEdit, setEdgeLengthEdit] = useState<{ edgeIndex: number; value: string } | null>(null);

  // Track container size (the viewport itself no longer scrolls natively - content is
  // positioned via the `pan` offset instead, see below). Uses a ResizeObserver rather than
  // just a window-resize listener specifically because this component stays mounted while its
  // tab is hidden (Index.tsx renders all tabs with forceMount) - opening a project from the
  // Projects tab measures a display:none container (clientWidth/Height = 0) if we only ever
  // measure once on mount. ResizeObserver re-fires when the element's actual box size changes,
  // including the 0x0 -> real-size jump that happens when switching back to this tab.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const updateDimensions = () => {
      setContainerWidth(el.clientWidth);
      setContainerHeight(el.clientHeight);
    };
    updateDimensions();
    const observer = new ResizeObserver(updateDimensions);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Only reset page when a new PDF is loaded (do not reset on tab switch)
  useEffect(() => {
    if (pdfData && currentPage === 0) {
      setCurrentPage(1);
    }
    setPageAspectRatio(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pdfData]);

  // Reset pan/zoom to a clean fit-to-width view whenever the visible page changes, or a
  // (possibly different) project's PDF is loaded - without the pdfData dependency, opening
  // another project while already on page 1 left the camera wherever it was for the previous
  // project, and the pan clamp then trapped it away from center.
  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [currentPage, pdfData]);

  // Rendered size of the current page including zoom - used for the overlay SVG and the
  // content layer so nothing is silently clipped, and so click coordinates map correctly.
  const renderedWidth = containerWidth * zoom;
  const renderedHeight = pageAspectRatio ? renderedWidth / pageAspectRatio : renderedWidth * 1.294;

  // Keeps the page from being dragged off into empty space forever - clamps the pan offset so
  // the content can only go a small margin past the viewport edge, like a bounded canvas.
  const clampPan = useCallback((x: number, y: number, w: number, h: number) => {
    const margin = 150;
    let minX: number, maxX: number, minY: number, maxY: number;
    if (w <= containerWidth) {
      const centerX = (containerWidth - w) / 2;
      minX = centerX - margin;
      maxX = centerX + margin;
    } else {
      minX = containerWidth - w - margin;
      maxX = margin;
    }
    if (h <= containerHeight) {
      const centerY = (containerHeight - h) / 2;
      minY = centerY - margin;
      maxY = centerY + margin;
    } else {
      minY = containerHeight - h - margin;
      maxY = margin;
    }
    return { x: Math.min(maxX, Math.max(minX, x)), y: Math.min(maxY, Math.max(minY, y)) };
  }, [containerWidth, containerHeight]);

  // Zooms toward a specific point (in viewport px) so that point stays fixed on screen -
  // used for both Ctrl/Cmd+scroll (cursor position) and the +/- buttons (viewport center).
  const zoomTo = useCallback((newZoomRaw: number, anchorX: number, anchorY: number) => {
    const newZoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, newZoomRaw));
    if (newZoom === zoom || renderedWidth === 0 || renderedHeight === 0) return;
    const newW = containerWidth * newZoom;
    const newH = pageAspectRatio ? newW / pageAspectRatio : newW * 1.294;
    const fracX = (anchorX - pan.x) / renderedWidth;
    const fracY = (anchorY - pan.y) / renderedHeight;
    const newPanX = anchorX - fracX * newW;
    const newPanY = anchorY - fracY * newH;
    setZoom(newZoom);
    setPan(clampPan(newPanX, newPanY, newW, newH));
  }, [zoom, pan, containerWidth, pageAspectRatio, renderedWidth, renderedHeight, clampPan]);

  // Let Ctrl/Cmd + scroll wheel zoom in/out anchored at the cursor. React's onWheel is passive
  // by default so it can't preventDefault - a native listener is needed to stop the page from
  // scrolling. A plain scroll (no modifier) pans the canvas instead, like a whiteboard app.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) {
        const rect = el.getBoundingClientRect();
        zoomTo(zoom - e.deltaY * 0.004, e.clientX - rect.left, e.clientY - rect.top);
      } else {
        setPan(prev => clampPan(prev.x - e.deltaX, prev.y - e.deltaY, renderedWidth, renderedHeight));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoom, zoomTo, clampPan, renderedWidth, renderedHeight]);

  // Hold Space to pan by dragging with the left mouse button, in ANY mode - this is the
  // standard canvas-app pattern (Figma/Photoshop/Miro) for panning the camera mid-draw without
  // hijacking a key combo a browser already owns (WASD risks a stray Ctrl+W closing the tab;
  // arrow keys fight the browser's own focus-scroll/outline behavior on whatever button last
  // had focus). Middle-drag and left-drag-while-idle still work too.
  const [spaceHeld, setSpaceHeld] = useState(false);
  // Set when a pan drag actually moved the mouse, so the click that fires right after
  // mouseup (e.g. ending a space-pan over a region, or over the drawing surface) doesn't
  // also place a region point / select a region.
  const suppressNextClickRef = useRef(false);

  useEffect(() => {
    if (!pdfData) return;
    const isTypingTarget = (el: EventTarget | null) => {
      const tag = (el as HTMLElement)?.tagName;
      return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT";
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || isTypingTarget(e.target)) return;
      e.preventDefault(); // stop page-scroll and stop it "clicking" a focused button
      if (!e.repeat) {
        // Drop focus from whatever button was last clicked so no focus-ring/outline can
        // reappear while the user is just trying to pan.
        const active = document.activeElement as HTMLElement | null;
        if (active && active !== document.body) active.blur();
        setSpaceHeld(true);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpaceHeld(false);
    };
    const onBlur = () => setSpaceHeld(false);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [pdfData]);

  // Click-and-drag panning: left-drag when idle or when Space is held (so it never steals
  // clicks meant for placing points/selecting a region unless the user explicitly asks to
  // pan), middle-drag always.
  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    const isMiddle = e.button === 1;
    const isLeftIdle = e.button === 0 && drawingMode === DrawingMode.None && !editingRegionId;
    const isLeftSpacePan = e.button === 0 && spaceHeld;
    if (!isMiddle && !isLeftIdle && !isLeftSpacePan) return;
    if (isMiddle || isLeftSpacePan) e.preventDefault();
    panStartRef.current = { mouseX: e.clientX, mouseY: e.clientY, panX: pan.x, panY: pan.y, w: renderedWidth, h: renderedHeight };
    setIsPanning(true);
  };

  useEffect(() => {
    if (!isPanning) return;
    const onMove = (e: MouseEvent) => {
      const start = panStartRef.current;
      if (!start) return;
      if (Math.abs(e.clientX - start.mouseX) > 3 || Math.abs(e.clientY - start.mouseY) > 3) {
        suppressNextClickRef.current = true;
      }
      const newX = start.panX + (e.clientX - start.mouseX);
      const newY = start.panY + (e.clientY - start.mouseY);
      setPan(clampPan(newX, newY, start.w, start.h));
    };
    const onUp = () => {
      setIsPanning(false);
      panStartRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isPanning, clampPan]);

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
    if (suppressNextClickRef.current) {
      suppressNextClickRef.current = false;
      return;
    }
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
    if (!svg || typeof svg.createSVGPoint !== "function") return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const cursorpt = pt.matrixTransform(ctm.inverse());
    // See note above: fraction-of-width so regions don't drift with zoom or window size.
    const clickX = cursorpt.x / renderedWidth;
    const clickY = cursorpt.y / renderedWidth;

    if (currentPoints.length >= 6) {
      const dxPx = (clickX - currentPoints[0]) * renderedWidth;
      const dyPx = (clickY - currentPoints[1]) * renderedWidth;
      if (Math.sqrt(dxPx * dxPx + dyPx * dyPx) <= SNAP_RADIUS_PX) {
        // Hovering/clicking right on the start point closes the shape instead of adding a
        // (near-duplicate) point there. completeRegionDrawing() itself checks whether the
        // closing edge would cross another edge of the same shape.
        completeRegionDrawing();
        return;
      }

    }

    if (currentPoints.length >= 2) {
      const lastX = currentPoints[currentPoints.length - 2];
      const lastY = currentPoints[currentPoints.length - 1];
      const crossing = findCrossing(lastX, lastY, clickX, clickY);
      if (crossing === "self") {
        toast.error("That line crosses this shape's own edge");
        return;
      }
      if (crossing === "region") {
        toast.error("That line crosses into another region");
        return;
      }
    }

    setCurrentPoints(prev => [...prev, clickX, clickY]);
  };

  // Complete region drawing
  const completeRegionDrawing = () => {
    if (drawingMode === DrawingMode.Scaling) return; // Don't allow in calibration mode
    if (currentPoints.length < 6) {
      toast.error("Please draw at least 3 points to create a region");
      return;
    }
    const firstX = currentPoints[0], firstY = currentPoints[1];
    const lastX = currentPoints[currentPoints.length - 2], lastY = currentPoints[currentPoints.length - 1];
    const closingCrossing = findCrossing(lastX, lastY, firstX, firstY);
    if (closingCrossing === "self") {
      toast.error("Can't close the shape - the closing edge crosses another edge");
      return;
    }
    if (closingCrossing === "region") {
      toast.error("Can't close the shape - the closing edge crosses into another region");
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

  // Right-click undoes the last placed point (to fix a misclick without starting over) - or,
  // if only one point has been placed so far, cancels the region/calibration entirely.
  const handleSvgContextMenu = (e: React.MouseEvent<SVGSVGElement>) => {
    if (drawingMode !== DrawingMode.Drawing && drawingMode !== DrawingMode.Scaling) return;
    e.preventDefault();
    if (currentPoints.length <= 2) {
      cancelDrawing();
    } else {
      setCurrentPoints(prev => prev.slice(0, -2));
    }
  };

  // Cancel drawing or calibration
  const cancelDrawing = () => {
    setCurrentPoints([]);
    setDrawingMode(DrawingMode.None);
    setCalibrationInput("");
    setCalibrationFeet("");
    setCalibrationInches("");
    setCalibrationUnit("ft");
    setMousePos(null);
  };

  // Calibration helpers
  const getCalibrationPixelDistance = () => {
    if (currentPoints.length !== 4) return 0;
    const [x1, y1, x2, y2] = currentPoints;
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  };

  // The real-world calibration distance, always resolved to feet - null if not enough has
  // been entered yet. Feet uses its own two boxes (feet + inches); other units use the single
  // calibrationInput box.
  const getCalibrationRealFeet = (): number | null => {
    if (calibrationUnit === "ft") {
      const ft = parseFloat(calibrationFeet) || 0;
      const inches = parseFloat(calibrationInches) || 0;
      const total = ft + inches / 12;
      return total > 0 ? total : null;
    }
    const val = parseFloat(calibrationInput);
    if (!val || val <= 0) return null;
    if (calibrationUnit === "in") return val / 12;
    if (calibrationUnit === "cm") return val / 30.48;
    if (calibrationUnit === "m") return val * 3.28084;
    return val;
  };

  const handleCalibrationSave = () => {
    const pixelDist = getCalibrationPixelDistance();
    const realDistInFeet = getCalibrationRealFeet();
    if (pixelDist === 0 || realDistInFeet === null) {
      toast.error("Please select two points and enter a valid real-world distance.");
      return;
    }
    const newScale = pixelDist / realDistInFeet;
    setScale(newScale);
    setScaleUnit(calibrationUnit);
    setCurrentPoints([]);
    setDrawingMode(DrawingMode.None);
    setCalibrationInput("");
    setCalibrationFeet("");
    setCalibrationInches("");
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

  // Checks segment (x1,y1)-(x2,y2) against the shape currently being drawn (self-intersection,
  // once it has at least 3 placed points) and against every other region already on this page
  // (closed polygons) - used to block/flag a line that would cut back across its own shape or
  // straight through an unrelated region while drawing.
  const findCrossing = (x1: number, y1: number, x2: number, y2: number): "self" | "region" | null => {
    if (currentPoints.length >= 6 && segmentCrossesPolyline(currentPoints, x1, y1, x2, y2)) {
      return "self";
    }
    if (pageRegions.some(region => segmentCrossesPolyline(region.points, x1, y1, x2, y2, { closed: true }))) {
      return "region";
    }
    return null;
  };

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

  // Dragging from a point of the region's outline (rather than an existing corner) inserts a
  // new point right there and immediately starts dragging it, like Figma/Illustrator path
  // editing - lets the user add a corner mid-edge instead of only moving existing ones.
  const handleEdgeInsertMouseDown = (edgeIndex: number, e: React.MouseEvent<SVGLineElement>) => {
    if (!editingPoints) return;
    const svg = e.currentTarget.ownerSVGElement;
    if (!svg || typeof svg.createSVGPoint !== "function") return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const cursorpt = pt.matrixTransform(ctm.inverse());
    const insertAt = (edgeIndex + 1) * 2;
    const newPoints = [...editingPoints];
    newPoints.splice(insertAt, 0, cursorpt.x / renderedWidth, cursorpt.y / renderedWidth);
    setEditingPoints(newPoints);
    setDraggedPointIdx(insertAt);
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
      setEdgeLengthEdit(null);
      toast.success("Region points updated!");
    }
  };

  const handleCancelEdit = () => {
    setEditingRegionId(null);
    setEditingPoints(null);
    setDraggedPointIdx(null);
    setEdgeLengthEdit(null);
  };

  // Opens the inline correction input for one edge of the region currently being edited,
  // pre-filled with the edge's current length (in the calibrated display unit).
  const handleEdgeLabelClick = (edgeIndex: number, currentLengthFeet: number) => {
    setEdgeLengthEdit({
      edgeIndex,
      value: feetToDisplayUnit(currentLengthFeet, scaleUnit).toFixed(1),
    });
  };

  // Snaps the edge's end point (the second corner in polygon order) along the edge's existing
  // direction so the edge's real-world length matches exactly what the user typed - fixes a
  // hand-drawn edge that came out e.g. 0.1ft off without having to redraw the whole region.
  const commitEdgeLengthEdit = () => {
    if (!edgeLengthEdit || !editingPoints || !editingRegionId) {
      setEdgeLengthEdit(null);
      return;
    }
    const typed = parseFloat(edgeLengthEdit.value);
    if (!typed || typed <= 0) {
      setEdgeLengthEdit(null);
      return;
    }
    const targetFeet = displayUnitToFeet(typed, scaleUnit);
    const targetFraction = targetFeet * scale;
    const n = editingPoints.length / 2;
    const ai = edgeLengthEdit.edgeIndex;
    const bi = (ai + 1) % n;
    const ax = editingPoints[ai * 2], ay = editingPoints[ai * 2 + 1];
    const bx = editingPoints[bi * 2], by = editingPoints[bi * 2 + 1];
    const dx = bx - ax, dy = by - ay;
    const currentFraction = Math.sqrt(dx * dx + dy * dy);
    if (currentFraction === 0) {
      setEdgeLengthEdit(null);
      return;
    }
    const factor = targetFraction / currentFraction;
    const newPoints = [...editingPoints];
    newPoints[bi * 2] = ax + dx * factor;
    newPoints[bi * 2 + 1] = ay + dy * factor;
    setEditingPoints(newPoints);
    setEdgeLengthEdit(null);
  };

  // Memoize region polygons, with edit handles if editing
  const renderedRegions = useMemo(() => (
    pageRegions.map((region) => {
      const isEditing = editingRegionId === region.id;
      const pointsToRender = isEditing && editingPoints ? editingPoints : region.points;
      return (
        <g key={region.id}>
          <polygon
            points={pointsToRender.map((_p, i) =>
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
              if (suppressNextClickRef.current) {
                suppressNextClickRef.current = false;
                return;
              }
              setSelectedRegionId(region.id);
              // Start editing on double click
              if (e.detail === 2) handleRegionEdit(region.id);
            }}
            style={{ cursor: isEditing ? "move" : "pointer" }}
          />
          {/* Invisible, generously-wide hit area along each edge while editing - dragging from
              here (rather than an existing point) inserts a new point at the cursor. Rendered
              before the point circles so a click near an existing corner still hits the point,
              not the edge behind it. */}
          {isEditing && pointsToRender.length >= 6 && Array.from({ length: pointsToRender.length / 2 }).map((_, i) => {
            const n = pointsToRender.length / 2;
            const j = (i + 1) % n;
            return (
              <line
                key={`edge-insert-${i}`}
                x1={pointsToRender[i * 2] * renderedWidth}
                y1={pointsToRender[i * 2 + 1] * renderedWidth}
                x2={pointsToRender[j * 2] * renderedWidth}
                y2={pointsToRender[j * 2 + 1] * renderedWidth}
                stroke="transparent"
                strokeWidth={14}
                style={{ cursor: "copy", pointerEvents: "all" }}
                onMouseDown={e => {
                  e.stopPropagation();
                  handleEdgeInsertMouseDown(i, e);
                }}
              />
            );
          })}
          {/* Draggable corner points - enlarged and hollow (transparent center, only a ring)
              so they're easy to grab without hiding the blueprint linework right under them. */}
          {isEditing && pointsToRender.length >= 2 && Array.from({ length: pointsToRender.length / 2 }).map((_, i) => (
            <g
              key={i}
              onMouseDown={e => {
                e.stopPropagation();
                handlePointMouseDown(i * 2);
              }}
              style={{ cursor: "pointer", pointerEvents: "all" }}
            >
              <circle
                cx={pointsToRender[i * 2] * renderedWidth}
                cy={pointsToRender[i * 2 + 1] * renderedWidth}
                r={8}
                fill="none"
                stroke="#ffffff"
                strokeWidth={3}
                opacity={0.9}
              />
              <circle
                cx={pointsToRender[i * 2] * renderedWidth}
                cy={pointsToRender[i * 2 + 1] * renderedWidth}
                r={8}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={1.5}
              />
            </g>
          ))}
          {/* Edge length labels - calibrated real-world distance along each side, inset toward
              the region's interior (so two regions sharing/close to an edge don't collide) and
              rotated to read along the edge. No background box - a white text halo keeps them
              legible without blocking the region's own color/blueprint underneath. Clickable
              while editing to type an exact correction if a hand-drawn edge is a bit off. */}
          {pointsToRender.length >= 6 && computeEdgeLabels(pointsToRender, scale, scaleUnit, renderedWidth).map(spec => (
            <g
              key={`edge-${spec.edgeIndex}`}
              transform={`rotate(${spec.angleDeg}, ${spec.x}, ${spec.y})`}
              onClick={isEditing ? e => { e.stopPropagation(); handleEdgeLabelClick(spec.edgeIndex, spec.lengthFeet); } : undefined}
              style={{ cursor: isEditing ? "pointer" : "default" }}
            >
              {isEditing && (
                <rect
                  x={spec.x - spec.width / 2}
                  y={spec.y - spec.fontSize / 2 - 2}
                  width={spec.width}
                  height={spec.fontSize + 4}
                  fill="transparent"
                  style={{ pointerEvents: "all" }}
                />
              )}
              <text
                x={spec.x}
                y={spec.y + spec.fontSize * 0.32}
                textAnchor="middle"
                fontSize={spec.fontSize}
                fill="#111827"
                stroke="#ffffff"
                strokeWidth={3}
                strokeLinejoin="round"
                paintOrder="stroke"
                style={{ pointerEvents: "none" }}
              >
                {spec.text}
              </text>
            </g>
          ))}
          {/* Region name at the centroid, same transparent-halo styling as the edge labels -
              only shown when the shape is comfortably bigger than the text. */}
          {(() => {
            const nameSpec = computeRegionNameLabel(pointsToRender, region.name, renderedWidth);
            if (!nameSpec) return null;
            return (
              <text
                x={nameSpec.x}
                y={nameSpec.y + nameSpec.fontSize * 0.32}
                textAnchor="middle"
                fontSize={nameSpec.fontSize}
                fontWeight={600}
                fill="#111827"
                stroke="#ffffff"
                strokeWidth={3.5}
                strokeLinejoin="round"
                paintOrder="stroke"
                style={{ pointerEvents: "none" }}
              >
                {nameSpec.text}
              </text>
            );
          })()}
        </g>
      );
    })
  ), [pageRegions, renderedWidth, selectedRegionId, editingRegionId, editingPoints, scale, scaleUnit]);

  // Memoize current drawing polyline and points
  const renderedDrawing = useMemo(() => {
    if (drawingMode !== DrawingMode.Drawing || currentPoints.length === 0) return null;

    const lastX = currentPoints[currentPoints.length - 2];
    const lastY = currentPoints[currentPoints.length - 1];
    const canClose = currentPoints.length >= 6;
    let snappedToStart = false;
    if (canClose && mousePos) {
      const dxPx = (mousePos.x - currentPoints[0]) * renderedWidth;
      const dyPx = (mousePos.y - currentPoints[1]) * renderedWidth;
      snappedToStart = Math.sqrt(dxPx * dxPx + dyPx * dyPx) <= SNAP_RADIUS_PX;
    }
    // While hovering the start point, the rubber-band line latches onto it exactly rather than
    // following the raw cursor - the visual cue that clicking now will close the shape.
    const rubberEndX = snappedToStart ? currentPoints[0] : mousePos?.x;
    const rubberEndY = snappedToStart ? currentPoints[1] : mousePos?.y;
    const rubberCrosses = !!(
      currentPoints.length >= 2 && mousePos && rubberEndX !== undefined && rubberEndY !== undefined &&
      findCrossing(lastX, lastY, rubberEndX, rubberEndY)
    );
    const rubberColor = rubberCrosses ? "#ef4444" : "#3b82f6";

    return (
      <>
        <polyline
          // Thinner, more transparent line for accuracy
          points={currentPoints.map((_p, i) =>
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
        {/* Rubber-band line from the last placed point to the cursor (or the snapped start
            point), to help line up the next click. Turns red if it would cross another edge
            of this same shape. */}
        {mousePos && rubberEndX !== undefined && rubberEndY !== undefined && (
          <line
            x1={lastX * renderedWidth}
            y1={lastY * renderedWidth}
            x2={rubberEndX * renderedWidth}
            y2={rubberEndY * renderedWidth}
            stroke={rubberColor}
            strokeWidth={rubberCrosses ? 1.5 : 1}
            strokeDasharray="3,3"
            opacity={rubberCrosses ? 0.9 : 0.5}
          />
        )}
        {/* Snap-to-close indicator: a dashed ring around the start point while hovering close
            enough to it to latch on and close the shape on click. */}
        {snappedToStart && (
          <circle
            cx={currentPoints[0] * renderedWidth}
            cy={currentPoints[1] * renderedWidth}
            r={SNAP_RADIUS_PX}
            fill="none"
            stroke={rubberCrosses ? "#ef4444" : "#3b82f6"}
            strokeWidth={1.5}
            strokeDasharray="2,2"
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
        {/* Live length label on each already-placed segment (plus the rubber-band segment to
            the cursor), sized to fit its own segment so short clicks don't overlap. */}
        {computeEdgeLabels(
          mousePos ? [...currentPoints, mousePos.x, mousePos.y] : currentPoints,
          scale,
          scaleUnit,
          renderedWidth,
          { closed: false, baseFontSize: 9, inset: 6 }
        ).map(spec => (
          <g key={`seg-${spec.edgeIndex}`} transform={`rotate(${spec.angleDeg}, ${spec.x}, ${spec.y})`}>
            <text x={spec.x} y={spec.y + spec.fontSize * 0.32} textAnchor="middle" fontSize={spec.fontSize} fill="#1e3a8a" opacity={0.85}>
              {spec.text}
            </text>
          </g>
        ))}
      </>
    );
  }, [drawingMode, currentPoints, renderedWidth, mousePos, scale, scaleUnit, pageRegions]);

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
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap justify-between items-center gap-2">
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
                onClick={() => zoomTo(zoom - 0.2, containerWidth / 2, containerHeight / 2)}
              >
                <MinusIcon className="h-4 w-4" />
              </Button>
              <span className="text-sm w-16 text-center">{Math.round(zoom * 100)}%</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => zoomTo(zoom + 0.2, containerWidth / 2, containerHeight / 2)}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <span className="text-xs text-muted-foreground hidden lg:inline">
                (Ctrl/Cmd+scroll to zoom, Space+drag or scroll to pan, right-click to undo a point)
              </span>
            </div>
          </div>
          {/* Drawing/calibration controls get their own row so the (wider, when calibrating in
              feet) input group never runs into the zoom hint text above. */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant={drawingMode === DrawingMode.Scaling ? "secondary" : "outline"}
              size="sm"
              onClick={() => {
                setDrawingMode(DrawingMode.Scaling);
                setCurrentPoints([]);
                setCalibrationInput("");
                setCalibrationFeet("");
                setCalibrationInches("");
                setCalibrationUnit("ft");
              }}
            >
              Calibrate Scale
            </Button>
            {drawingMode === DrawingMode.Scaling && (
              <div className="flex items-center gap-2 ml-2 flex-wrap">
                {calibrationUnit === "ft" ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      className="border px-2 py-1 rounded w-16 text-black bg-white"
                      placeholder="ft"
                      value={calibrationFeet}
                      onChange={e => setCalibrationFeet(e.target.value)}
                      style={{ color: "#000", background: "#fff" }}
                    />
                    <span className="text-sm text-muted-foreground">ft</span>
                    <input
                      type="number"
                      className="border px-2 py-1 rounded w-16 text-black bg-white"
                      placeholder="in"
                      value={calibrationInches}
                      onChange={e => setCalibrationInches(e.target.value)}
                      style={{ color: "#000", background: "#fff" }}
                    />
                    <span className="text-sm text-muted-foreground">in</span>
                  </div>
                ) : (
                  <input
                    type="number"
                    className="border px-2 py-1 rounded w-20 text-black bg-white"
                    placeholder="Length"
                    value={calibrationInput}
                    onChange={e => setCalibrationInput(e.target.value)}
                    style={{ color: "#000", background: "#fff" }}
                  />
                )}
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
                <Button size="sm" onClick={handleCalibrationSave} disabled={currentPoints.length !== 4 || getCalibrationRealFeet() === null}>
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
      <div className="flex flex-col md:flex-row gap-4 items-stretch">
        <Card className="flex-1 min-w-0 w-full">
          <CardContent className="p-4">
            <div
              ref={containerRef}
              className="relative border border-border rounded-md w-full overflow-hidden select-none"
              style={{
                minHeight: 400,
                height: "calc(100vh - 220px)",
                backgroundImage:
                  "linear-gradient(to right, rgba(128,128,128,0.18) 1px, transparent 1px), linear-gradient(to bottom, rgba(128,128,128,0.18) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
                cursor: isPanning
                  ? "grabbing"
                  : spaceHeld
                  ? "grab"
                  : drawingMode === DrawingMode.None && !editingRegionId
                  ? "grab"
                  : drawingMode !== DrawingMode.None
                  ? "crosshair"
                  : "default",
              }}
              onMouseDown={handleCanvasMouseDown}
            >
              {pdfData ? (
                <div
                  style={{
                    width: renderedWidth,
                    height: renderedHeight,
                    position: "absolute",
                    left: 0,
                    top: 0,
                    transform: `translate(${pan.x}px, ${pan.y}px)`,
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
                    onContextMenu={handleSvgContextMenu}
                  >
                    {renderedRegions}
                    {renderedDrawing}
                    {renderedCalibration}
                  </svg>
                  {/* Inline correction input for an edge length - opened by clicking an edge's
                      label while editing a region's points. */}
                  {editingRegionId && editingPoints && edgeLengthEdit && (() => {
                    const n = editingPoints.length / 2;
                    const ai = edgeLengthEdit.edgeIndex;
                    const bi = (ai + 1) % n;
                    const midX = ((editingPoints[ai * 2] + editingPoints[bi * 2]) / 2) * renderedWidth;
                    const midY = ((editingPoints[ai * 2 + 1] + editingPoints[bi * 2 + 1]) / 2) * renderedWidth;
                    return (
                      <div
                        style={{
                          position: "absolute",
                          left: midX,
                          top: midY,
                          transform: "translate(-50%, -140%)",
                          zIndex: 5,
                          background: "#fff",
                          border: "1px solid #3b82f6",
                          borderRadius: 4,
                          padding: "3px 4px",
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
                        }}
                        onMouseDown={e => e.stopPropagation()}
                      >
                        <input
                          autoFocus
                          type="number"
                          step="0.1"
                          value={edgeLengthEdit.value}
                          onChange={e => setEdgeLengthEdit({ ...edgeLengthEdit, value: e.target.value })}
                          onKeyDown={e => {
                            if (e.key === "Enter") commitEdgeLengthEdit();
                            if (e.key === "Escape") setEdgeLengthEdit(null);
                          }}
                          style={{ width: 56, fontSize: 12, color: "#000", background: "#fff", border: "1px solid #ccc", borderRadius: 3, padding: "1px 4px" }}
                        />
                        <span style={{ fontSize: 11, color: "#374151" }}>{scaleUnit}</span>
                        <Button size="sm" className="h-6 px-2 py-0" onClick={commitEdgeLengthEdit}>
                          <CheckIcon className="h-3 w-3" />
                        </Button>
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="flex items-center justify-center h-full">
                  <p className="text-muted-foreground">
                    Upload a blueprint PDF to get started
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="w-full md:w-72 shrink-0">
          <CardContent className="p-4">
            {/* Same explicit height as the PDF viewer's container div (above) so both
                cards end up the same total height, with the list scrolling internally
                instead of growing past the viewer. */}
            <div
              className="flex flex-col"
              style={{ minHeight: 400, height: "calc(100vh - 220px)" }}
            >
              <h3 className="font-medium mb-3 shrink-0">Regions on Page {currentPage}</h3>
              <RegionsList
                regions={pageRegions}
                selectedId={selectedRegionId}
                onSelect={setSelectedRegionId}
                onDelete={handleDeleteRegion}
                editingRegionId={editingRegionId}
                onSaveEdit={handleSaveEditedRegion}
                onCancelEdit={handleCancelEdit}
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BlueprintView;
