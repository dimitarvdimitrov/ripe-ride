'use client';

import { MapContainer, TileLayer, Polyline, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import L from 'leaflet';

// Fix for default markers in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

interface Route {
  id: string;
  name: string;
  distance: string;
  elevation: string;
  lastDone?: string;
  points: { lat: number; lon: number; elevation?: number }[];
}

interface MapProps {
  center?: [number, number];
  zoom?: number;
  className?: string;
  route?: Route | null;
}

// Component to fit map bounds to route
function FitBounds({ route }: { route: Route | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (route && route.points.length > 0) {
      const bounds = L.latLngBounds(
        route.points.map(point => [point.lat, point.lon])
      );
      map.fitBounds(bounds, { padding: [20, 20] });
    }
  }, [route, map]);
  
  return null;
}

export default function Map({ 
  center = [52.3676, 4.9041], // Default to Amsterdam
  zoom = 13,
  className = "h-full w-full",
  route
}: MapProps) {
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      className={className}
      style={{ height: '100%', width: '100%' }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      
      {/* Route polyline */}
      {route && route.points.length > 0 && (
        <>
          <Polyline
            positions={route.points.map(point => [point.lat, point.lon])}
            color="red"
            weight={3}
            opacity={0.7}
          />
          <FitBounds route={route} />
        </>
      )}
    </MapContainer>
  );
}