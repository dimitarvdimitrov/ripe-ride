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

interface GridData {
  gridX: number;
  gridY: number;
  distance: number;
}

interface GridAnalysis {
  gridConfig: {
    gridSizeKm: number;
    referencePoint: [number, number];
  };
  gridData: GridData[];
  stats: {
    totalGrids: number;
    totalDistance: number;
    averageDistance: number;
    maxDistance: number;
  };
}

interface MapProps {
  center?: [number, number];
  zoom?: number;
  className?: string;
  route?: Route | null;
  gridAnalysis?: GridAnalysis | null;
}

// Convert grid coordinates to lat/lng bounds
function gridToLatLngBounds(gridX: number, gridY: number, gridConfig: { gridSizeKm: number, referencePoint: [number, number] }): L.LatLngBounds {
  const [refLat, refLng] = gridConfig.referencePoint;
  
  const kmToLatDegrees = gridConfig.gridSizeKm / 111;
  const kmToLngDegrees = gridConfig.gridSizeKm / (111 * Math.cos(refLat * Math.PI / 180));
  
  const west = refLng + (gridX * kmToLngDegrees);
  const east = refLng + ((gridX + 1) * kmToLngDegrees);
  const south = refLat + (gridY * kmToLatDegrees);
  const north = refLat + ((gridY + 1) * kmToLatDegrees);
  
  return L.latLngBounds([south, west], [north, east]);
}

// Get color based on distance density
function getGridColor(distance: number, maxDistance: number): { color: string, fillColor: string, fillOpacity: number } {
  if (distance === 0) {
    return { color: 'blue', fillColor: 'blue', fillOpacity: 0.02 };
  }
  
  const intensity = distance / maxDistance;
  
  if (intensity > 0.8) {
    return { color: '#d32f2f', fillColor: '#f44336', fillOpacity: 0.6 }; // Dark red
  } else if (intensity > 0.6) {
    return { color: '#f57c00', fillColor: '#ff9800', fillOpacity: 0.5 }; // Orange
  } else if (intensity > 0.4) {
    return { color: '#fbc02d', fillColor: '#ffeb3b', fillOpacity: 0.4 }; // Yellow
  } else if (intensity > 0.2) {
    return { color: '#689f38', fillColor: '#8bc34a', fillOpacity: 0.3 }; // Light green
  } else {
    return { color: '#388e3c', fillColor: '#4caf50', fillOpacity: 0.2 }; // Green
  }
}

// Component to show grid with route density visualization
function GridDensityOverlay({ showGrid, gridAnalysis }: { showGrid: boolean, gridAnalysis: GridAnalysis | null }) {
  if (!showGrid || !gridAnalysis) return null;
  
  const { gridData, gridConfig, stats } = gridAnalysis;
  
  return (
    <>
      {gridData.map((grid, index) => {
        const bounds = gridToLatLngBounds(grid.gridX, grid.gridY, gridConfig);
        const colorStyle = getGridColor(grid.distance, stats.maxDistance);
        
        return (
          <Rectangle
            key={`density-${grid.gridX}-${grid.gridY}`}
            bounds={bounds}
            pathOptions={{
              ...colorStyle,
              weight: 1,
              opacity: 0.8
            }}
          />
        );
      })}
    </>
  );
}

// Component to fit map bounds to grid analysis area
function FitBounds({ gridAnalysis }: { gridAnalysis: GridAnalysis | null }) {
  const map = useMap();
  
  useEffect(() => {
    if (gridAnalysis && gridAnalysis.gridData.length > 0) {
      // Find the bounds of all grid squares
      const allBounds: L.LatLngBounds[] = [];
      
      gridAnalysis.gridData.forEach(grid => {
        const bounds = gridToLatLngBounds(grid.gridX, grid.gridY, gridAnalysis.gridConfig);
        allBounds.push(bounds);
      });
      
      if (allBounds.length > 0) {
        // Create a bounds that encompasses all grid squares
        const combinedBounds = allBounds.reduce((acc, bounds) => {
          return acc.extend(bounds);
        }, allBounds[0]);
        
        map.fitBounds(combinedBounds, { padding: [50, 50] });
      }
    }
  }, [gridAnalysis, map]);
  
  return null;
}

export default function Map({ 
  center = [52.3676, 4.9041], // Default to Amsterdam
  zoom = 13,
  className = "h-full w-full",
  route,
  gridAnalysis
                            }: MapProps) {
  const [showGrid, setShowGrid] = useState(true);
  
  return (
    <div className="relative h-full w-full">
      {/* Single grid toggle button */}
      <div className="absolute top-4 right-4 z-[1000]">
        <button
          onClick={() => setShowGrid(!showGrid)}
          className="bg-white px-3 py-1 rounded shadow-md text-sm font-medium hover:bg-gray-50 border"
        >
          {showGrid ? 'Hide Grid' : 'Show Grid'}
        </button>
      </div>
      
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
        
        {/* Always show density grid if analysis is available */}
        {gridAnalysis && <GridDensityOverlay showGrid={showGrid} gridAnalysis={gridAnalysis} />}
        
        {/* Route polyline */}
        {route && route.points.length > 0 && (
          <Polyline
            positions={route.points.map(point => [point.lat, point.lon])}
            color="red"
            weight={3}
            opacity={0.7}
          />
        )}
        
        {/* Fit bounds to grid analysis area */}
        <FitBounds gridAnalysis={gridAnalysis} />
      </MapContainer>
    </div>
  );
}
