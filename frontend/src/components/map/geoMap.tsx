
import { useEffect, useRef } from "react";
import {
  Map as MapLibreMap,
  LngLatBounds,
  NavigationControl,
  Popup,
  setWorkerUrl,
  type GeoJSONSource,
  type MapLayerEventType,
  type StyleSpecification,
} from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url";
import "maplibre-gl/dist/maplibre-gl.css";
import React from "react";
import { emptyHotspotFeatureCollection, type HotspotFeature, type HotspotFeatureCollection } from "../../types/hotspotTypes";

setWorkerUrl(workerUrl);

export const darkMatterStyle =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

/** Esri World Imagery with its compatible places overlay; source credits are shown by MapLibre. */
export const satelliteStyle: StyleSpecification = {
  version: 8,
  sources: {
    "esri-world-imagery": {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      attribution: "© <a href=\"https://www.esri.com/\" target=\"_blank\" rel=\"noopener noreferrer\">Esri</a> — Sources: Esri, Maxar, Earthstar Geographics, and the GIS User Community",
    },
    "esri-reference-labels": {
      type: "raster",
      tiles: ["https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}"],
      tileSize: 256,
      attribution: "© Esri",
    },
  },
  layers: [
    { id: "satellite-imagery", type: "raster", source: "esri-world-imagery" },
    { id: "satellite-reference-labels", type: "raster", source: "esri-reference-labels" },
  ],
};

export type FireFeatureCollection = HotspotFeatureCollection;

type GeoMapProps = {
  className?: string;
  center?: [number, number];
  zoom?: number;
  basemapStyle?: string | StyleSpecification;
  onError?: (message: string) => void;
  fireData?: FireFeatureCollection;
  onHotspotSelect?: (feature: HotspotFeature) => void;
  fitToData?: boolean;
  boundariesVisible?: boolean;
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
  if (!map.getSource("fire-hotspots")) map.addSource("fire-hotspots", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [],
    },
  });

  // Outer red glow
  if (!map.getLayer("fire-glow-outer")) map.addLayer({
    id: "fire-glow-outer",
    type: "circle",
    source: "fire-hotspots",
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        3, 12,
        8, 18,
        13, 28,
        17, 36,
      ],
      "circle-color": "#ff6b1a",
      "circle-opacity": 0.34,
      "circle-blur": 1,
    },
  });

  // Inner hot glow
  if (!map.getLayer("fire-glow-inner")) map.addLayer({
    id: "fire-glow-inner",
    type: "circle",
    source: "fire-hotspots",
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        3, 7,
        8, 10,
        13, 14,
        17, 18,
      ],
      "circle-color": "#ff4d16",
      "circle-opacity": 0.92,
      "circle-blur": 0.65,
    },
  });

  // Bright fire center
  if (!map.getLayer("fire-hotspot-core")) map.addLayer({
    id: "fire-hotspot-core",
    type: "circle",
    source: "fire-hotspots",
    paint: {
      "circle-radius": [
        "interpolate",
        ["linear"],
        ["zoom"],
        3, 4.5,
        8, 5.5,
        13, 7,
        17, 8,
      ],
      "circle-color": "#ffb000",
      "circle-opacity": 1,
      "circle-stroke-color": "#fff7e8",
      "circle-stroke-width": 2,
    },
  });
}

function updateFireData(map: MapLibreMap, data: FireFeatureCollection) {
  const source = map.getSource("fire-hotspots") as GeoJSONSource | undefined;
  source?.setData(data);
}

function popupRow(label: string, value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const row = document.createElement("p");
  row.className = "mt-1 text-xs text-slate-300";
  const title = document.createElement("span");
  title.className = "text-slate-500";
  title.textContent = `${label}: `;
  row.append(title, document.createTextNode(String(value)));
  return row;
}

function openHotspotPopup(map: MapLibreMap, feature: HotspotFeature, popup: Popup) {
  const content = document.createElement("div");
  content.className = "min-w-44 rounded bg-[#10131a] p-2 text-slate-100";
  const heading = document.createElement("p");
  heading.className = "font-semibold text-orange-300";
  heading.textContent = String(feature.properties.region ?? "Satellite hotspot");
  content.append(heading);
  const properties = feature.properties;
  const frp = properties.frpMw ?? properties.frp;
  [
    popupRow("Sensor", properties.sensor ?? properties.satellite),
    popupRow("Observed (UTC)", properties.acqDatetimeUtc ?? [properties.acq_date, properties.acq_time].filter(Boolean).join(" ")),
    popupRow("Confidence", properties.confidence),
    popupRow("FRP", frp === undefined || frp === null ? null : `${frp} MW`),
  ].forEach((row) => { if (row) content.append(row); });
  popup.setLngLat([feature.geometry.coordinates[0], feature.geometry.coordinates[1]]).setDOMContent(content).addTo(map);
}

function openHotspotTooltip(event: MapLayerEventType["mouseenter"], popup: Popup) {
  const feature = event.features?.[0];
  if (!feature || feature.geometry.type !== "Point") return;
  const content = document.createElement("div");
  content.className = "rounded bg-[#10131a] px-2 py-1 text-xs text-slate-100 shadow-lg";
  const properties = feature.properties ?? {};
  const region = properties.region ?? "Satellite hotspot";
  const date = properties.acqDatetimeUtc ?? properties.acq_date ?? properties.acquisitionDate;
  content.textContent = `${region}${typeof date === "string" ? ` · ${date.slice(0, 10)}` : ""}`;
  popup.setLngLat(event.lngLat).setDOMContent(content).addTo(event.target);
}

const DEFAULT_CENTER: [number, number] = [78.9629, 22.5937];

export default function GeoMap({
  className = "",
  center = DEFAULT_CENTER,
  zoom = 4.35,
  basemapStyle = darkMatterStyle,
  onError,
  fireData,
  onHotspotSelect,
  fitToData = false,
  boundariesVisible = true,
}: GeoMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onErrorRef = useRef(onError);
  const fireDataRef = useRef<FireFeatureCollection>(fireData ?? emptyHotspotFeatureCollection);
  const onHotspotSelectRef = useRef(onHotspotSelect);
  const popupRef = useRef<Popup | null>(null);
  const hoverPopupRef = useRef<Popup | null>(null);
  const hasFittedDataRef = useRef(false);
  const boundariesRef = useRef(boundariesVisible);

  useEffect(() => {
    boundariesRef.current = boundariesVisible;
    const map = mapRef.current;
    if (map?.getLayer("satellite-reference-labels")) map.setLayoutProperty("satellite-reference-labels", "visibility", boundariesVisible ? "visible" : "none");
  }, [boundariesVisible]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    fireDataRef.current = fireData ?? emptyHotspotFeatureCollection;
    if (mapRef.current) updateFireData(mapRef.current, fireDataRef.current);
  }, [fireData]);

  useEffect(() => {
    const map = mapRef.current;
    if (!fitToData || hasFittedDataRef.current || !map || !map.isStyleLoaded() || !fireData?.features.length) return;
    const coordinates = fireData.features.map((feature) => feature.geometry.coordinates);
    const firstCoordinate: [number, number] = [coordinates[0][0], coordinates[0][1]];
    const bounds = new LngLatBounds(firstCoordinate, firstCoordinate);
    coordinates.slice(1).forEach((coordinate) => bounds.extend([coordinate[0], coordinate[1]]));
    map.fitBounds(bounds, { padding: 64, maxZoom: 4.5, duration: 0 });
    hasFittedDataRef.current = true;
  }, [fireData, fitToData]);

  useEffect(() => { onHotspotSelectRef.current = onHotspotSelect; }, [onHotspotSelect]);

  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    let map: MapLibreMap;
    try {
      map = new MapLibreMap({
      container,
      style: basemapStyle,
      center,
      zoom,
      minZoom: 2,
      maxZoom: 18,
      attributionControl: { compact: true },
      cooperativeGestures: false,
      scrollZoom: true,
      renderWorldCopies: false,
      });
    } catch (error) {
      onErrorRef.current?.(`Unable to start the map. Enable WebGL or hardware acceleration and reload. ${error instanceof Error ? error.message : ""}`);
      return;
    }

    mapRef.current = map;
    popupRef.current = new Popup({ closeButton: true, closeOnClick: false, offset: 10 });
    hoverPopupRef.current = new Popup({ closeButton: false, closeOnClick: false, offset: 9 });

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
      if (map.getLayer("satellite-reference-labels")) map.setLayoutProperty("satellite-reference-labels", "visibility", boundariesRef.current ? "visible" : "none");
      updateFireData(map, fireDataRef.current);
      attachHotspotInteractions();
    };

    const selectHotspot = (event: MapLayerEventType["click"]) => {
      const feature = event.features?.[0];
      if (!feature || feature.geometry.type !== "Point") return;
      const coordinates = feature.geometry.coordinates;
      if (!Array.isArray(coordinates) || coordinates.length < 2 || typeof coordinates[0] !== "number" || typeof coordinates[1] !== "number") return;
      const hotspot: HotspotFeature = { type: "Feature", id: feature.id, geometry: { type: "Point", coordinates: [coordinates[0], coordinates[1]] }, properties: feature.properties ?? {} };
      openHotspotPopup(map, hotspot, popupRef.current ?? new Popup());
      onHotspotSelectRef.current?.(hotspot);
    };
    const showHotspotCursor = (event: MapLayerEventType["mouseenter"]) => {
      map.getCanvas().style.cursor = "pointer";
      openHotspotTooltip(event, hoverPopupRef.current ?? new Popup());
    };
    const clearHotspotCursor = () => {
      map.getCanvas().style.cursor = "";
      hoverPopupRef.current?.remove();
    };
    const attachHotspotInteractions = () => {
      map.off("click", "fire-hotspot-core", selectHotspot);
      map.off("mouseenter", "fire-hotspot-core", showHotspotCursor);
      map.off("mouseleave", "fire-hotspot-core", clearHotspotCursor);
      map.on("click", "fire-hotspot-core", selectHotspot);
      map.on("mouseenter", "fire-hotspot-core", showHotspotCursor);
      map.on("mouseleave", "fire-hotspot-core", clearHotspotCursor);
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
      map.off("click", "fire-hotspot-core", selectHotspot);
      map.off("mouseenter", "fire-hotspot-core", showHotspotCursor);
      map.off("mouseleave", "fire-hotspot-core", clearHotspotCursor);
      map.remove();
      mapRef.current = null;
      popupRef.current = null;
      hoverPopupRef.current = null;
    };
  }, [basemapStyle, center, zoom]);

  return (
    <div
      ref={mapContainerRef}
      className={`h-full w-full ${className}`}
    />
  );
}
