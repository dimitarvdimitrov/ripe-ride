'use client';

import { MapContainer, TileLayer, Polyline, useMap, Rectangle } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
import L from 'leaflet';
import { type HeatmapCell } from '@/lib/heatmapTracker';
import { createHeatmapConfig } from '@/lib/heatmapConfig';

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
  distance: number | null; // Distance in meters, null if error
  elevation: number | null; // Max elevation in meters, null if error
  lastDone?: string;
  points: { lat: number; lon: number; elevation?: number }[];
  error?: string;
  overlapScore?: number;
  routeHeatmap?: HeatmapAnalysis;
}

interface HeatmapAnalysis {
  heatmapData: HeatmapCell[];
  stats: {
    totalCells: number;
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
  heatmapAnalysis?: HeatmapAnalysis | null;
  heatmapSizeKm: number;
  onHeatmapSizeChange: (size: number) => void;
  heatmapMode: 'general' | 'per-route';
  onHeatmapModeChange: (mode: 'general' | 'per-route') => void;
}

// Convert heatmap coordinates to lat/lng bounds
function cellToLatLngBounds(cellX: number, cellY: number, heatmapConfig: { heatmapSizeKm: number, referencePoint: [number, number] }): L.LatLngBounds {
  const [refLat, refLng] = heatmapConfig.referencePoint;
  
  const kmToLatDegrees = heatmapConfig.heatmapSizeKm / 111;
  const kmToLngDegrees = heatmapConfig.heatmapSizeKm / (111 * Math.cos(refLat * Math.PI / 180));
  
  const west = refLng + (cellX * kmToLngDegrees);
  const east = refLng + ((cellX + 1) * kmToLngDegrees);
  const south = refLat + (cellY * kmToLatDegrees);
  const north = refLat + ((cellY + 1) * kmToLatDegrees);
  
  return L.latLngBounds([south, west], [north, east]);
}


// Get color based on distance density
function getHeatmapColor(distance: number, maxDistance: number): { color: string, fillColor: string, fillOpacity: number } {
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

// Component to show heatmap with route density visualization
function HeatmapDensityOverlay({ showHeatmap, heatmapAnalysis, heatmapSizeKm }: { showHeatmap: boolean, heatmapAnalysis: HeatmapAnalysis | null, heatmapSizeKm: number }) {
  if (!showHeatmap || !heatmapAnalysis) return null;
  
  const { heatmapData, stats } = heatmapAnalysis;
  const heatmapConfig = createHeatmapConfig(heatmapSizeKm);
  
  return (
    <>
      {heatmapData.map((cell) => {
        const bounds = cellToLatLngBounds(cell.cellX, cell.cellY, heatmapConfig);
        const colorStyle = getHeatmapColor(cell.distance, stats.maxDistance);
        
        return (
          <Rectangle
            key={`density-${cell.cellX}-${cell.cellY}`}
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

// Component to fit map bounds to heatmap analysis area
function FitBounds({ heatmapAnalysis, heatmapSizeKm }: { heatmapAnalysis: HeatmapAnalysis | null, heatmapSizeKm: number }) {
  const map = useMap();
  
  useEffect(() => {
    if (heatmapAnalysis && heatmapAnalysis.heatmapData.length > 0) {
      // Find the bounds of all heatmap cells
      const allBounds: L.LatLngBounds[] = [];
      const heatmapConfig = createHeatmapConfig(heatmapSizeKm);
      
      heatmapAnalysis.heatmapData.forEach(cell => {
        const bounds = cellToLatLngBounds(cell.cellX, cell.cellY, heatmapConfig);
        allBounds.push(bounds);
      });
      
      if (allBounds.length > 0) {
        // Create a bounds that encompasses all heatmap cells
        const combinedBounds = allBounds.reduce((acc, bounds) => {
          return acc.extend(bounds);
        }, allBounds[0]);
        
        map.fitBounds(combinedBounds, { padding: [50, 50] });
      }
    }
  }, [heatmapAnalysis, heatmapSizeKm, map]);
  
  return null;
}

export default function Map({ 
  center = [52.3676, 4.9041], // Default to Amsterdam
  zoom = 13,
  className = "h-full w-full",
  route,
  heatmapAnalysis,
  heatmapSizeKm,
  onHeatmapSizeChange,
  heatmapMode,
  onHeatmapModeChange
}: MapProps) {
  const [showHeatmap, setShowHeatmap] = useState(true);
  
  return (
    <div className="relative h-full w-full">
      {/* Heatmap controls */}
      <div className="absolute top-4 right-4 z-[1000] bg-white rounded-lg shadow-md border p-3 space-y-3">
        <button
          onClick={() => setShowHeatmap(!showHeatmap)}
          className="w-full px-3 py-1 rounded text-sm font-medium hover:bg-gray-50 border"
        >
          {showHeatmap ? 'Hide Heatmap' : 'Show Heatmap'}
        </button>
        
        {/* Heatmap Mode Toggle */}
        <button
          onClick={() => onHeatmapModeChange(heatmapMode === 'general' ? 'per-route' : 'general')}
          className={`w-full px-3 py-1 rounded text-sm font-medium border transition-colors ${
            heatmapMode === 'per-route' 
              ? 'bg-blue-100 text-blue-700 border-blue-300' 
              : 'hover:bg-gray-50 border-gray-300'
          }`}
          disabled={heatmapMode === 'per-route' && !route?.routeHeatmap}
        >
          {heatmapMode === 'general' ? 'Show Route Heatmap' : 'Show General Heatmap'}
        </button>
        
        {/* Heatmap Size Control */}
        <div className="min-w-[200px]">
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Heatmap Size: {heatmapSizeKm}km
          </label>
          <div className="single-range-container">
            <input
              type="range"
              min="0.5"
              max="20"
              step="0.5"
              value={heatmapSizeKm}
              onChange={(e) => onHeatmapSizeChange(Number(e.target.value))}
              className="w-full appearance-none cursor-pointer slider-thumb-purple"
            />
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-0.5">
            <span>0.5km</span>
            <span>20km</span>
          </div>
        </div>
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
        
        {/* Show density heatmap */}
        {(() => {
          if (heatmapMode === 'per-route' && route?.routeHeatmap) {
            return <HeatmapDensityOverlay showHeatmap={showHeatmap} heatmapAnalysis={route.routeHeatmap} heatmapSizeKm={heatmapSizeKm} />;
          }
          return heatmapAnalysis && <HeatmapDensityOverlay showHeatmap={showHeatmap} heatmapAnalysis={heatmapAnalysis} heatmapSizeKm={heatmapSizeKm} />;
        })()}
        
        {/* Route polyline */}
        {route && route.points.length > 0 && (
          <Polyline
            positions={route.points.map(point => [point.lat, point.lon])}
            color="#fc4c02"
            weight={3.5}
            opacity={0.7}
          />
        )}
        
        {/* Fit bounds to heatmap analysis area */}
        <FitBounds heatmapAnalysis={heatmapAnalysis || null} heatmapSizeKm={heatmapSizeKm} />
      </MapContainer>
    </div>
  );
}
