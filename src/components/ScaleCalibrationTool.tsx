import React, { useState } from "react";
import { useProject } from "@/context/ProjectContext";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// This tool lets the user draw a line on the blueprint and enter the real-world length for calibration.
const ScaleCalibrationTool = () => {
  const { scale, setScale } = useProject();
  const [isCalibrating, setIsCalibrating] = useState(false);
  const [points, setPoints] = useState<number[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [unit, setUnit] = useState("ft");

  // Start calibration mode
  const startCalibration = () => {
    setIsCalibrating(true);
    setPoints([]);
    setInputValue("");
  };

  // Handle click on the SVG overlay to pick two points
  const handleSvgClick = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isCalibrating) return;
    const svg = e.currentTarget;
    if (typeof svg.createSVGPoint !== "function") return;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return;
    const cursorpt = pt.matrixTransform(ctm.inverse());
    setPoints((prev) => [...prev, cursorpt.x, cursorpt.y]);
  };

  // Calculate pixel distance between two points
  const getPixelDistance = () => {
    if (points.length !== 4) return 0;
    const [x1, y1, x2, y2] = points;
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  };

  // When user enters real-world length and confirms
  const handleCalibrate = () => {
    const pixelDist = getPixelDistance();
    const realDist = parseFloat(inputValue);
    if (pixelDist === 0 || !realDist || realDist <= 0) {
      toast.error("Please select two points and enter a valid real-world distance.");
      return;
    }
    // Calculate scale: pixels per real-world unit
    const newScale = pixelDist / realDist;
    setScale(newScale);
    setIsCalibrating(false);
    setPoints([]);
    setInputValue("");
    toast.success("Scale calibrated!");
  };

  return (
    <div>
      <Button
        variant={isCalibrating ? "secondary" : "outline"}
        size="sm"
        onClick={startCalibration}
      >
        Calibrate Scale
      </Button>
      {isCalibrating && (
        <div className="mt-2 space-y-2">
          <p className="text-xs">Click two points on the blueprint to measure a known distance.</p>
          <svg
            width="100%"
            height="40"
            style={{ display: "block", pointerEvents: "auto", background: "#f9fafb" }}
            onClick={handleSvgClick}
          >
            {points.length === 4 && (
              <line
                x1={points[0]}
                y1={points[1]}
                x2={points[2]}
                y2={points[3]}
                stroke="#3b82f6"
                strokeWidth={2}
              />
            )}
            {points.length >= 2 && (
              <circle cx={points[0]} cy={points[1]} r={4} fill="#3b82f6" />
            )}
            {points.length === 4 && (
              <circle cx={points[2]} cy={points[3]} r={4} fill="#3b82f6" />
            )}
          </svg>
          {points.length === 4 && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                className="border px-2 py-1 rounded w-20"
                placeholder="Length"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
              />
              <select
                className="border px-1 py-1 rounded"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
              >
                <option value="ft">ft</option>
                <option value="in">in</option>
                <option value="m">m</option>
                <option value="cm">cm</option>
              </select>
              <Button size="sm" onClick={handleCalibrate}>
                Set Scale
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ScaleCalibrationTool;
