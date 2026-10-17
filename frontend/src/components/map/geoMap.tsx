
import { useEffect, useRef } from "react";
import {
  Map as MapLibreMap,
  NavigationControl,
  setWorkerUrl,
  type GeoJSONSource,
} from "maplibre-gl";
import type { FeatureCollection, Point } from "geojson";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";

setWorkerUrl(workerUrl);

export const darkMatterStyle =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

export type FireFeatureCollection = FeatureCollection<
  Point,
  {
    id?: string;
    intensity?: number;
    confidence?: number;
  }
>;

type GeoMapProps = {
  className?: string;
  center?: [number, number];
  zoom?: number;
  basemapStyle?: string;
  onError?: (message: string) => void;
  fireData?: FireFeatureCollection;
};

function applyWildfireDarkTheme(map: MapLibreMap) {
  const layers = map.getStyle().layers ?? [];

  for (const layer of layers) {
    const id = layer.id.toLowerCase();
    const sourceLayer =
      "source-layer" in layer
        ? (layer["source-layer"] ?? "").toLowerCase()
        : "";

    const name = `${id} ${sourceLayer}`;

    if (layer.type === "background") {
      map.setPaintProperty(
        layer.id,
        "background-color",
        "#000003",
      );
      continue;
    }

    if (layer.type === "fill") {
      if (
        /water|ocean|lake|riverbank/.test(name) ||
        sourceLayer === "water"
      ) {
        map.setPaintProperty(
          layer.id,
          "fill-color",
          "#85c0f8",
        );
        map.setPaintProperty(layer.id, "fill-opacity", 1);
      } else if (
        /park|wood|forest|landcover|landuse|grass/.test(name)
      ) {
        map.setPaintProperty(
          layer.id,
          "fill-color",
          "#0e6d58",
        );
        map.setPaintProperty(layer.id, "fill-opacity", 0.95);
      } else if (name.includes("building")) {
        map.setPaintProperty(
          layer.id,
          "fill-color",
          "#253141",
        );
        map.setPaintProperty(layer.id, "fill-opacity", 0.9);
      } else {
        map.setPaintProperty(
          layer.id,
          "fill-color",
          "#36455b",
        );
        map.setPaintProperty(layer.id, "fill-opacity", 1);
      }

      continue;
    }

    if (layer.type === "line") {
      const isWaterway =
        sourceLayer === "waterway" ||
        id.includes("waterway");

      const isBoundary =
        sourceLayer === "boundary" ||
        /boundary|admin|border|country|state|province|district/.test(
          id,
        );

      if (isWaterway) {
        map.setPaintProperty(
          layer.id,
          "line-color",
          "#58a8c2",
        );
        map.setPaintProperty(layer.id, "line-opacity", 0.95);
        map.setPaintProperty(layer.id, "line-width", [
          "interpolate",
          ["linear"],
          ["zoom"],
          2, 0.7,
          7, 1.3,
          12, 2,
          16, 2.5,
        ]);
      } else if (isBoundary) {
        const isCountry =
          /country|international/.test(id) ||
          /admin-0/.test(sourceLayer);

        const isDistrict =
          /district|admin-3|admin-4/.test(name);

        const color = isCountry
          ? "#e45b00"
          : isDistrict
            ? "#c75f4d"
            : "#f37142";

        map.setPaintProperty(
          layer.id,
          "line-color",
          color,
        );
        map.setPaintProperty(layer.id, "line-opacity", 1);
        map.setPaintProperty(layer.id, "line-width", [
          "interpolate",
          ["linear"],
          ["zoom"],
          2, isCountry ? 1.4 : 0.8,
          5, isCountry ? 2 : 1.2,
          8, isCountry ? 2.8 : 1.8,
          12, isCountry ? 3.5 : 2.4,
          16, isCountry ? 4 : 3,
        ]);
      } else if (
        /road|street|transportation|highway/.test(name)
      ) {
        map.setPaintProperty(
          layer.id,
          "line-color",
          "#9a2904",
        );
        map.setPaintProperty(layer.id, "line-opacity", 0.9);
      }

      continue;
    }

    if (layer.type === "symbol") {
      map.setPaintProperty(
        layer.id,
        "text-color",
        "#D6E2F0",
      );
      map.setPaintProperty(
        layer.id,
        "text-halo-color",
        "#080D16",
      );
      map.setPaintProperty(layer.id, "text-halo-width", 1.5);
      map.setPaintProperty(layer.id, "text-halo-blur", 0.3);
    }
  }
}

function addFireHotspots(map: MapLibreMap) {
  if (map.getSource("fire-hotspots")) return;

  map.addSource("fire-hotspots", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [],
    },
  });

  // Outer red glow
  map.addLayer({
    id: "fire-glow-outer",
    type: "circle",
    source: "fire-hotspots",
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        3, 10,
        8, 20,
        13, 32,
        17, 42,
      ],
      "circle-color": "#FF180C",
      "circle-opacity": 0.25,
      "circle-blur": 1,
    },
  });

  // Inner hot glow
  map.addLayer({
    id: "fire-glow-inner",
    type: "circle",
    source: "fire-hotspots",
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        3, 5,
        8, 10,
        13, 16,
        17, 21,
      ],
      "circle-color": "#FF3B1F",
      "circle-opacity": 0.8,
      "circle-blur": 0.65,
    },
  });

  // Bright fire center
  map.addLayer({
    id: "fire-hotspot-core",
    type: "circle",
    source: "fire-hotspots",
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        3, 2,
        8, 3,
        13, 4.5,
        17, 6,
      ],
      "circle-color": "#FFF1CF",
      "circle-opacity": 1,
      "circle-stroke-color": "#FF5938",
      "circle-stroke-width": 1.5,
    },
  });
}

export default function GeoMap({
  className = "",
  center = [78.9629, 22.5937],
  zoom = 4.35,
  basemapStyle = darkMatterStyle,
  onError,
  fireData,
}: GeoMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    const map = new MapLibreMap({
      container,
      style: basemapStyle,
      center,
      zoom,
      minZoom: 2,
      maxZoom: 18,
      attributionControl: false,
      cooperativeGestures: false,
      scrollZoom: true,
      renderWorldCopies: false,
    });

    mapRef.current = map;

    map.addControl(
      new NavigationControl({ showCompass: true }),
      "bottom-left",
    );

    const reportError = (event: {
      error?: { message?: string };
    }) => {
      const message =
        event.error?.message ?? "Unable to load the map.";
      onErrorRef.current?.(message);
    };

    const styleTheme = () => {
      if (basemapStyle === darkMatterStyle) {
        applyWildfireDarkTheme(map);
      }

      addFireHotspots(map);

      if (fireData) {
        const source = map.getSource(
          "fire-hotspots",
        ) as GeoJSONSource | undefined;

        source?.setData(fireData);
      }
    };

    map.on("error", reportError);
    map.on("style.load", styleTheme);

    const resizeObserver = new ResizeObserver(() => {
      map.resize();
    });

    resizeObserver.observe(container);

    return () => {
      resizeObserver.disconnect();
      map.off("error", reportError);
      map.off("style.load", styleTheme);
      map.remove();
      mapRef.current = null;
    };
  }, [basemapStyle, center, zoom]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !fireData || !map.isStyleLoaded()) return;

    const source = map.getSource(
      "fire-hotspots",
    ) as GeoJSONSource | undefined;

    source?.setData(fireData);
  }, [fireData]);

  return (
    <div
      ref={mapContainerRef}
      className={`h-full w-full ${className}`}
    />
  );
}
