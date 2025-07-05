'use client';

import { MapContainer, TileLayer, Polyline, useMap, Rectangle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
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

// Function to create 5km x 5km grid squares covering the entire map view
function createGridSquares(mapBounds: L.LatLngBounds, gridSize: number = 5): L.LatLngBounds[] {
  const squares: L.LatLngBounds[] = [];
  
  const south = mapBounds.getSouth();
  const north = mapBounds.getNorth();
  const west = mapBounds.getWest();
  const east = mapBounds.getEast();
  
  // Use center latitude for longitude calculations
  const centerLat = (north + south) / 2;
  const kmToLatDegrees = gridSize / 111; // 1 degree latitude ≈ 111km
  const kmToLngDegrees = gridSize / (111 * Math.cos(centerLat * Math.PI / 180));
  
  // Find the starting points (align to grid)
  const startLat = Math.floor(south / kmToLatDegrees) * kmToLatDegrees;
  const startLng = Math.floor(west / kmToLngDegrees) * kmToLngDegrees;
  
  // Create grid squares to cover the entire view
  for (let lat = startLat; lat < north + kmToLatDegrees; lat += kmToLatDegrees) {
    for (let lng = startLng; lng < east + kmToLngDegrees; lng += kmToLngDegrees) {
      const southWest: [number, number] = [lat, lng];
      const northEast: [number, number] = [lat + kmToLatDegrees, lng + kmToLngDegrees];
      
      squares.push(L.latLngBounds(southWest, northEast));
    }
  }
  
  return squares;
}

// Component to track map bounds and create grid
function GridOverlay({ showGrid }: { showGrid: boolean }) {
  const map = useMap();
  const [mapBounds, setMapBounds] = useState<L.LatLngBounds | null>(null);
  
  useEffect(() => {
    const updateBounds = () => {
      setMapBounds(map.getBounds());
    };
    
    // Initial bounds
    updateBounds();
    
    // Update bounds when map moves
    map.on('moveend', updateBounds);
    map.on('zoomend', updateBounds);
    
    return () => {
      map.off('moveend', updateBounds);
      map.off('zoomend', updateBounds);
    };
  }, [map]);
  
  if (!showGrid || !mapBounds) return null;
  
  const gridSquares = createGridSquares(mapBounds);
  
  return (
    <>
      {gridSquares.map((bounds, index) => (
        <Rectangle
          key={index}
          bounds={bounds}
          pathOptions={{
            color: 'blue',
            weight: 1,
            opacity: 0.4,
            fillOpacity: 0.02,
            fillColor: 'blue'
          }}
        />
      ))}
    </>
  );
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
  const [showGrid, setShowGrid] = useState(true);
  
  return (
    <div className="relative h-full w-full">
      {/* Grid toggle button */}
      <button
        onClick={() => setShowGrid(!showGrid)}
        className="absolute top-4 right-4 z-[1000] bg-white px-3 py-1 rounded shadow-md text-sm font-medium hover:bg-gray-50 border"
      >
        {showGrid ? 'Hide Grid' : 'Show Grid'}
      </button>
      
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
        
        {/* Dynamic grid overlay */}
        <GridOverlay showGrid={showGrid} />
        
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
    </div>
  );
}