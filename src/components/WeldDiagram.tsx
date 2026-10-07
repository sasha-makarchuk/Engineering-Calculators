import { useEffect, useRef } from "react";
import type { WeldResult } from "../engineering/weldGroup";

// Diagram receives calculated geometry plus load/custom-point coordinates in base units.
interface WeldDiagramProps {
  result: WeldResult;
  xLoadBase: number;
  yLoadBase: number;
  xCustomBase: number;
  yCustomBase: number;
}

// Canvas visualizer for the weld pattern, hotspot nodes, centroid, and loading.
export function WeldDiagram({
  result,
  xLoadBase,
  yLoadBase,
  xCustomBase,
  yCustomBase,
}: WeldDiagramProps) {
  // React refs give the drawing code access to the actual canvas and its container.
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Redraw whenever the calculation result or relevant coordinates change.
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;

    if (!canvas || !container) return;

    // All canvas drawing is grouped in one function so it can also be called after resizing.
    const draw = () => {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Measure the wrapper rather than the canvas itself.
      const rect = container.getBoundingClientRect();

      // If the layout has not been calculated yet, wait for a later resize/frame.
      if (rect.width <= 0 || rect.height <= 0) return;

      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(320, rect.width);
      const height = Math.max(250, rect.height);

      // Set the canvas's internal resolution to match its displayed size.
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);

      // Keep drawing coordinates in CSS pixels while rendering at device-pixel resolution.
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Paint the dark background and engineering-style grid.
      ctx.fillStyle = "#0f172a";
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
      ctx.lineWidth = 1;

      for (let x = 0; x < width; x += 20) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }

      for (let y = 0; y < height; y += 20) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // Use the engineering result as the source of truth for the geometry shown.
      const geometry = result.geometry;

      const xValues = [
        ...geometry.points.map((point) => point.x),
        ...geometry.segments.flatMap((segment) => [segment.x1, segment.x2]),
        geometry.centroidX,
        xLoadBase,
        xCustomBase,
      ];

      const yValues = [
        ...geometry.points.map((point) => point.y),
        ...geometry.segments.flatMap((segment) => [segment.y1, segment.y2]),
        geometry.centroidY,
        yLoadBase,
        yCustomBase,
      ];

      // Find the drawing bounds and scale the engineering coordinates to the canvas.
      const rawMinX = Math.min(...xValues);
      const rawMaxX = Math.max(...xValues);
      const rawMinY = Math.min(...yValues);
      const rawMaxY = Math.max(...yValues);

      const xSpan = Math.max(rawMaxX - rawMinX, 1);
      const ySpan = Math.max(rawMaxY - rawMinY, 1);

      const padX = Math.max(xSpan * 0.18, 10);
      const padY = Math.max(ySpan * 0.18, 10);

      const minX = rawMinX - padX;
      const maxX = rawMaxX + padX;
      const minY = rawMinY - padY;
      const maxY = rawMaxY + padY;

      const margin = 30;

      const scale = Math.min(
        (width - 2 * margin) / Math.max(maxX - minX, 1),
        (height - 2 * margin) / Math.max(maxY - minY, 1)
      );

      const drawnWidth = (maxX - minX) * scale;
      const drawnHeight = (maxY - minY) * scale;

      const offsetX = (width - drawnWidth) / 2 - minX * scale;
      const offsetY = (height + drawnHeight) / 2 + minY * scale;

      const toCanvasX = (x: number) => offsetX + x * scale;
      const toCanvasY = (y: number) => offsetY - y * scale;

      // Draw the weld geometry after establishing the coordinate transform.
      ctx.strokeStyle = "#38bdf8";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";

      if (geometry.circular) {
        const diameter = geometry.centroidX * 2;

        ctx.beginPath();

        ctx.arc(
          toCanvasX(diameter / 2),
          toCanvasY(diameter / 2),
          (diameter / 2) * scale,
          0,
          2 * Math.PI
        );

        ctx.stroke();
      } else {
        result.geometry.segments.forEach((segment) => {
          ctx.beginPath();
          ctx.moveTo(toCanvasX(segment.x1), toCanvasY(segment.y1));
          ctx.lineTo(toCanvasX(segment.x2), toCanvasY(segment.y2));
          ctx.stroke();
        });
      }

      // Draw hotspot/evaluation points and their labels.
      result.geometry.points.forEach((point) => {
        const px = toCanvasX(point.x);
        const py = toCanvasY(point.y);

        ctx.fillStyle =
          point.name === "Custom" ? "#c084fc" : "#f59e0b";

        ctx.beginPath();
        ctx.arc(px, py, 5, 0, 2 * Math.PI);
        ctx.fill();

        ctx.fillStyle =
          point.name === "Custom" ? "#e9d5ff" : "#fef08a";

        ctx.font = "bold 10px monospace";
        ctx.fillText(point.name, px + 8, py - 6);
      });

      // Mark the calculated weld-group centroid.
      const cgX = toCanvasX(result.geometry.centroidX);
      const cgY = toCanvasY(result.geometry.centroidY);

      ctx.fillStyle = "#ef4444";

      ctx.beginPath();
      ctx.arc(cgX, cgY, 6, 0, 2 * Math.PI);
      ctx.fill();

      ctx.strokeStyle = "#fca5a5";
      ctx.lineWidth = 1.5;

      ctx.beginPath();
      ctx.arc(cgX, cgY, 11, 0, 2 * Math.PI);
      ctx.stroke();

      ctx.fillStyle = "#fca5a5";
      ctx.font = "bold 11px sans-serif";
      ctx.fillText("CG", cgX + 12, cgY + 4);

      // Draw applied forces and torsional moment at the load location.
      const loadX = toCanvasX(xLoadBase);
      const loadY = toCanvasY(yLoadBase);

      const scaleVector = Math.min(0.0025 * scale, 0.12);

      if (Math.abs(result.load.fx) > 1) {
        drawArrow(
          ctx,
          loadX,
          loadY,
          loadX + result.load.fx * scaleVector,
          loadY,
          "#22c55e",
          "Fx"
        );
      }

      if (Math.abs(result.load.fy) > 1) {
        drawArrow(
          ctx,
          loadX,
          loadY,
          loadX,
          loadY - result.load.fy * scaleVector,
          "#22c55e",
          "Fy"
        );
      }

      if (Math.abs(result.load.mz) > 1) {
        ctx.strokeStyle = "#a855f7";
        ctx.lineWidth = 2.5;

        ctx.beginPath();

        ctx.arc(
          loadX,
          loadY,
          22,
          0.2 * Math.PI,
          1.5 * Math.PI,
          result.load.mz < 0
        );

        ctx.stroke();

        ctx.fillStyle = "#c084fc";
        ctx.font = "10px sans-serif";
        ctx.fillText("Mz", loadX + 24, loadY - 18);
      }

      // Draw the optional custom stress-check point.
      if (xCustomBase !== 0 || yCustomBase !== 0) {
        const customX = toCanvasX(xCustomBase);
        const customY = toCanvasY(yCustomBase);

        ctx.strokeStyle = "#a855f7";
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.arc(customX, customY, 7, 0, 2 * Math.PI);
        ctx.stroke();
      }
    };

    // Draw after the browser has completed the initial layout.
    const animationFrame = requestAnimationFrame(draw);

    // Keep the responsive canvas synchronized with its container.
    const observer = new ResizeObserver(draw);
    observer.observe(container);

    window.addEventListener("resize", draw);

    return () => {
      cancelAnimationFrame(animationFrame);
      observer.disconnect();
      window.removeEventListener("resize", draw);
    };
  }, [result, xLoadBase, yLoadBase, xCustomBase, yCustomBase]);

  // React renders the container and canvas; the effect performs the actual drawing.
  return (
    <div
      ref={containerRef}
      className="w-full max-w-2xl aspect-[600/380]"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full rounded border border-slate-800/80 bg-slate-900 cursor-crosshair"
      />
    </div>
  );
}

// Small helper that draws a force vector, arrowhead, and label.
function drawArrow(
  ctx: CanvasRenderingContext2D,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: string,
  label: string
) {
  const headLength = 8;
  const dx = toX - fromX;
  const dy = toY - fromY;
  const angle = Math.atan2(dy, dx);

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(fromX, fromY);
  ctx.lineTo(toX, toY);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(toX, toY);

  ctx.lineTo(
    toX - headLength * Math.cos(angle - Math.PI / 6),
    toY - headLength * Math.sin(angle - Math.PI / 6)
  );

  ctx.lineTo(
    toX - headLength * Math.cos(angle + Math.PI / 6),
    toY - headLength * Math.sin(angle + Math.PI / 6)
  );

  ctx.closePath();
  ctx.fill();

  ctx.font = "10px sans-serif";
  ctx.fillText(label, toX + 6, toY + 4);
}