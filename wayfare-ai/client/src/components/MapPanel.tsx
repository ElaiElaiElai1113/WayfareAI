import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import type { Itinerary } from "@/types/itinerary";

export function MapPanel({ itinerary }: { itinerary: Itinerary | null }) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const firstCenter = useMemo<[number, number]>(() => itinerary?.center ?? [-9.1393, 38.7223], [itinerary]);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: {
        version: 8,
        sources: {},
        layers: [],
      },
      center: [firstCenter[0], firstCenter[1]],
      zoom: 11,
      attributionControl: false,
    });

    mapRef.current = map;
    map.on("load", () => {
      if (!map.getSource("osm")) {
        map.addSource("osm", {
          type: "raster",
          tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
          tileSize: 256,
          attribution: "&copy; OpenStreetMap"
        });
      }

      if (!map.getLayer("osm-tiles")) {
        map.addLayer({
          id: "osm-tiles",
          type: "raster",
          source: "osm",
          minzoom: 0,
          maxzoom: 19
        });
      }

      setMapLoaded(true);
    });

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [firstCenter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !itinerary || !mapLoaded) return;

    const markers: maplibregl.Marker[] = [];

    itinerary.days.forEach((day) => {
      day.stops.forEach((stop, idx) => {
        const el = document.createElement('div');
        el.className = 'custom-marker';
        el.style.cssText = `
          width: 36px;
          height: 36px;
          background: #0b50da;
          border: 3px solid white;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-weight: bold;
          font-size: 14px;
          box-shadow: 0 4px 12px rgba(11, 80, 218, 0.3);
        `;
        el.textContent = (idx + 1).toString();

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([stop.lon, stop.lat])
          .addTo(map);
        markers.push(marker);
      });

      if (day.routeGeometry?.length) {
        const sourceId = `route-${day.dayNumber}`;
        const lineId = `route-line-${day.dayNumber}`;

        if (map.getLayer(lineId)) map.removeLayer(lineId);
        if (map.getSource(sourceId)) map.removeSource(sourceId);

        map.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: {
              type: 'LineString',
              coordinates: day.routeGeometry
            },
            properties: {}
          }
        });

        map.addLayer({
          id: lineId,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': '#0b50da',
            'line-width': 4,
            'line-opacity': 0.72,
            'line-dasharray': [2, 2]
          }
        });
      }
    });

    map.flyTo({ center: [itinerary.center[0], itinerary.center[1]], zoom: 11, duration: 1000 });

    return () => markers.forEach((m) => m.remove());
  }, [itinerary, mapLoaded]);

  return (
    <div className="absolute inset-0 bg-slate-100">
      {/* Map Placeholder Background */}
      {!mapLoaded && (
        <div className="w-full h-full bg-cover bg-center opacity-80" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200')" }}></div>
      )}
      {/* Custom Map Markers (Simplified) for design */}
      {itinerary && itinerary.days.length > 0 && (
        <>
          <div className="absolute top-[30%] left-[40%] size-10 flex flex-col items-center">
            <div className="bg-primary text-white size-8 rounded-full border-4 border-white flex items-center justify-center shadow-lg font-bold text-sm">1</div>
            <div className="w-1 h-3 bg-white -mt-0.5"></div>
          </div>
          <div className="absolute top-[45%] left-[55%] size-10 flex flex-col items-center">
            <div className="bg-primary text-white size-8 rounded-full border-4 border-white flex items-center justify-center shadow-lg font-bold text-sm">2</div>
            <div className="w-1 h-3 bg-white -mt-0.5"></div>
          </div>
        </>
      )}
      {/* Map Container */}
      <div ref={mapContainer} className="w-full h-full" aria-label="Itinerary map" />
    </div>
  );
}
