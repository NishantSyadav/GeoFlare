import { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import type { FeatureCollection, MultiPolygon, Polygon } from "geojson";

type LandFeature = GeoJSON.Feature<Polygon | MultiPolygon>;
type LandCollection = FeatureCollection<Polygon | MultiPolygon>;
type Point = [number, number];

type Props = {
  width?: number;
  height?: number;
  className?: string;
  color?: string;
  oceanColor?: string;
  enableZoom?: boolean;
  showGlow?: boolean;
};

const LAND_DATA_URL =
  "https://raw.githubusercontent.com/martynafford/natural-earth-geojson/refs/heads/master/110m/physical/ne_110m_land.json";

function makeLandDots(features: LandFeature[]): Point[] {
  const dots: Point[] = [];

  for (const feature of features) {
    const [[minLng, minLat], [maxLng, maxLat]] = d3.geoBounds(feature);
    const step = 1.8;

    for (let lng = minLng; lng <= maxLng; lng += step) {
      for (let lat = minLat; lat <= maxLat; lat += step) {
        const point: Point = [lng, lat];
        if (d3.geoContains(feature, point)) dots.push(point);
      }
    }
  }

  return dots;
}

export default function InteractiveGlobe2({
  width = 800,
  height = 600,
  className = "",
  color = "255, 140, 40",
  oceanColor = "#0d0a09",
  enableZoom = false,
  showGlow = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const projectionRef = useRef<d3.GeoProjection | null>(null);
  const rotationRef = useRef<[number, number]>([0, 0]);
  const dragRef = useRef<{ startX: number; startY: number; rotation: [number, number] } | null>(null);
  const baseScaleRef = useRef(0);
  const [landFeatures, setLandFeatures] = useState<LandFeature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const landDots = useMemo(() => makeLandDots(landFeatures), [landFeatures]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadLand() {
      try {
        const response = await fetch(LAND_DATA_URL, { signal: controller.signal });
        if (!response.ok) {
          throw new Error(`Land data request failed with status ${response.status}`);
        }

        const data = (await response.json()) as LandCollection;
        setLandFeatures(data.features.filter((feature) => feature.geometry !== null));
      } catch (cause) {
        if (controller.signal.aborted) return;
        const message = cause instanceof Error ? cause.message : "Unknown network error";
        setError(`Unable to load the globe's land data: ${message}`);
      } finally {
        if (!controller.signal.aborted) setIsLoading(false);
      }
    }

    void loadLand();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !container || !context) return;

    let frameId = 0;
    let canvasWidth = 0;
    let canvasHeight = 0;
    let baseScale = 0;
    let lastFrameTime = 0;

    const resize = () => {
      const bounds = container.getBoundingClientRect();
      canvasWidth = bounds.width;
      canvasHeight = bounds.height;
      if (!canvasWidth || !canvasHeight) return;

      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(canvasWidth * pixelRatio);
      canvas.height = Math.round(canvasHeight * pixelRatio);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

      baseScale = Math.min(canvasWidth, canvasHeight) / 2.5;
      baseScaleRef.current = baseScale;
      projectionRef.current = d3
        .geoOrthographic()
        .scale(baseScale)
        .translate([canvasWidth / 2, canvasHeight / 2])
        .clipAngle(90);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(container);
    resize();

    const render = (time: number) => {
      if (time - lastFrameTime < 1000 / 30) {
        frameId = requestAnimationFrame(render);
        return;
      }

      const projection = projectionRef.current;
      if (projection && canvasWidth && canvasHeight) {
        const delta = lastFrameTime ? Math.min((time - lastFrameTime) / 1000, 0.1) : 0;
        lastFrameTime = time;

        if (!dragRef.current) {
          rotationRef.current[0] += delta * 30;
        }
        projection.rotate(rotationRef.current);

        const scale = projection.scale();
        const scaleFactor = scale / baseScale;
        const centerX = canvasWidth / 2;
        const centerY = canvasHeight / 2;
        const path = d3.geoPath().projection(projection).context(context);
        const orange = (alpha: number) => `rgba(${color}, ${alpha})`;

        context.clearRect(0, 0, canvasWidth, canvasHeight);

        if (showGlow) {
          const glow = context.createRadialGradient(
            centerX,
            centerY,
            scale * 0.95,
            centerX,
            centerY,
            scale * 1.35,
          );
          glow.addColorStop(0, orange(0.12));
          glow.addColorStop(1, orange(0));
          context.fillStyle = glow;
          context.fillRect(0, 0, canvasWidth, canvasHeight);
        }

        context.beginPath();
        path({ type: "Sphere" });
        context.fillStyle = oceanColor;
        context.fill();
        context.strokeStyle = orange(1);
        context.lineWidth = 2 * scaleFactor;
        context.stroke();

        context.beginPath();
        path(d3.geoGraticule()());
        context.strokeStyle = orange(0.2);
        context.lineWidth = scaleFactor;
        context.stroke();

        context.beginPath();
        for (const feature of landFeatures) path(feature);
        context.strokeStyle = orange(0.85);
        context.lineWidth = scaleFactor;
        context.stroke();

        context.fillStyle = orange(0.55);
        context.beginPath();
        for (const [lng, lat] of landDots) {
          const point = projection([lng, lat]);
          if (!point) continue;
          const radius = 1.2 * scaleFactor;
          context.moveTo(point[0] + radius, point[1]);
          context.arc(point[0], point[1], radius, 0, 2 * Math.PI);
        }
        context.fill();
      }

      frameId = requestAnimationFrame(render);
    };

    frameId = requestAnimationFrame(render);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frameId);
      projectionRef.current = null;
      baseScaleRef.current = 0;
    };
  }, [color, height, landDots, landFeatures, oceanColor, showGlow, width]);

  const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = event.currentTarget;
    dragRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      rotation: [...rotationRef.current],
    };
    canvas.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (!drag) return;

    rotationRef.current = [
      drag.rotation[0] - (event.clientX - drag.startX) * 0.5,
      Math.max(-90, Math.min(90, drag.rotation[1] + (event.clientY - drag.startY) * 0.5)),
    ];
  };

  const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
    if (!enableZoom) return;
    event.preventDefault();

    const projection = projectionRef.current;
    const baseScale = baseScaleRef.current;
    if (!projection || !baseScale) return;

    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    projection.scale(Math.max(baseScale * 0.5, Math.min(baseScale * 3, projection.scale() * zoomFactor)));
  };

  return (
    <div
      ref={containerRef}
      className={`relative ${className}`}
      style={{
        width: `${width}px`,
        maxWidth: "calc(100vw - 40px)",
        aspectRatio: `${width} / ${height}`,
      }}
    >
      <canvas
        ref={canvasRef}
        role="img"
        aria-label="Interactive orange globe"
        className="block h-full w-full cursor-grab touch-pan-y active:cursor-grabbing"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={() => {
          dragRef.current = null;
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
        onWheel={handleWheel}
      />
      <div className="absolute bottom-4 left-4 rounded-md border border-orange-500/20 bg-orange-950/40 px-2 py-1 text-xs text-orange-200/70 backdrop-blur-sm">
        {enableZoom ? "Drag to rotate · Scroll to zoom" : "Drag to rotate"}
      </div>
      {isLoading && (
        <span className="sr-only" role="status">
          Loading globe data
        </span>
      )}
      {error && (
        <p className="absolute bottom-12 left-4 max-w-[90%] rounded bg-[#0d0a09]/90 px-2 py-1 text-xs text-orange-200" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
