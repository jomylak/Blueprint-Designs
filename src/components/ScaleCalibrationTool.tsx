
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RulerIcon } from "lucide-react";
import { useProject } from "@/context/ProjectContext";
import { toast } from "sonner";

const ScaleCalibrationTool = () => {
  const { scale, setScale, scaleUnit, setScaleUnit } = useProject();
  const [isOpen, setIsOpen] = useState(false);
  const [referenceLength, setReferenceLength] = useState("10");
  const [tempScale, setTempScale] = useState(scale);
  const [tempUnit, setTempUnit] = useState(scaleUnit);
  
  const handleSave = () => {
    setScale(Number(tempScale));
    setScaleUnit(tempUnit);
    toast.success(`Scale set to 1 pixel = ${tempScale} ${tempUnit}`);
    setIsOpen(false);
  };

  const handleSimulatedCalibration = () => {
    // In a real app, this would involve drawing a line on the blueprint
    // and calculating pixel-to-real-world ratio
    const measuredPixels = 100; // This would come from user drawing a line
    const realWorldLength = Number(referenceLength);
    
    if (realWorldLength <= 0) {
      toast.error("Please enter a valid reference length");
      return;
    }
    
    const newScale = realWorldLength / measuredPixels;
    setTempScale(Number(newScale.toFixed(6)));
    toast.success("Calibration measurement applied");
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <RulerIcon className="h-4 w-4 mr-1" />
          Set Scale
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Scale Calibration</DialogTitle>
          <DialogDescription>
            Set the scale to convert pixel measurements to real-world dimensions.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="scale" className="col-span-1">Scale</Label>
            <Input
              id="scale"
              type="number"
              step="0.000001"
              value={tempScale}
              onChange={(e) => setTempScale(Number(e.target.value))}
              className="col-span-2"
            />
            <Select value={tempUnit} onValueChange={setTempUnit}>
              <SelectTrigger className="col-span-1">
                <SelectValue placeholder="Unit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ft">ft</SelectItem>
                <SelectItem value="m">m</SelectItem>
                <SelectItem value="cm">cm</SelectItem>
                <SelectItem value="in">in</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="border-t border-border pt-4">
            <h4 className="text-sm font-medium mb-2">Calibration Helper</h4>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="reference" className="col-span-1">Reference</Label>
              <Input
                id="reference"
                type="number"
                value={referenceLength}
                onChange={(e) => setReferenceLength(e.target.value)}
                className="col-span-2"
              />
              <div className="col-span-1">{tempUnit}</div>
            </div>
            <div className="mt-2">
              <Button type="button" variant="outline" size="sm" onClick={handleSimulatedCalibration}>
                Apply Measurement
              </Button>
              <p className="text-xs text-muted-foreground mt-2">
                In a full implementation, you would draw a line on the blueprint and enter the real-world length it represents.
              </p>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>Cancel</Button>
          <Button onClick={handleSave}>Save Scale</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ScaleCalibrationTool;
