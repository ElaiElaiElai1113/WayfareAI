import { useEffect, useMemo, useRef } from "react";
import maplibregl from "maplibre-gl";
import { Card } from "@/components/ui/card";
import type { Itinerary } from "@/types/itinerary";

export function MapPanel({ itinerary }: { itinerary: Itinerary | null }) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  const firstCenter = useMemo<[number, number]>(() => itinerary?.center ?? [-9.1393, 38.7223], [itinerary]);

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    mapRef.current = new maplibregl.Map({
      container: mapContainer.current,
      style: "https://demotiles.maplibre.org/style.json",
      center: [firstCenter[0], firstCenter[1]],
      zoom: 11
    });

    mapRef.current.addControl(new maplibregl.NavigationControl(), "top-right");

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [firstCenter]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !itinerary) return;

    const markers: maplibregl.Marker[] = [];

    itinerary.days.forEach((day) => {
      day.stops.forEach((stop, idx) => {
        const marker = new maplibregl.Marker({ color: "#0f766e" })
          .setLngLat([stop.lon, stop.lat])
          .setPopup(new maplibregl.Popup().setHTML(`<strong>${idx + 1}. ${stop.name}</strong><br/>${stop.category}`))
          .addTo(map);
        markers.push(marker);
      });

      const sourceId = `route-${day.dayNumber}`;
      const lineId = `route-line-${day.dayNumber}`;

      if (map.getLayer(lineId)) map.removeLayer(lineId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);

      if (day.routeGeometry?.length) {
        map.addSource(sourceId, {
          type: "geojson",
          data: {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: day.routeGeometry
            },
            properties: {}
          }
        });

        map.addLayer({
          id: lineId,
          type: "line",
          source: sourceId,
          paint: {
            "line-color": "#0f766e",
            "line-width": 4,
            "line-opacity": 0.72
          }
        });
      }
    });

    map.flyTo({ center: [itinerary.center[0], itinerary.center[1]], zoom: 11 });

    return () => markers.forEach((m) => m.remove());
  }, [itinerary]);

  return (
    <Card className="h-[520px] p-2">
      <div ref={mapContainer} className="h-full w-full rounded-xl" aria-label="Itinerary map" />
    </Card>
  );
}

