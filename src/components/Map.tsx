'use client';

import { MapContainer, TileLayer, Polyline, useMap, Rectangle, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect, useState } from 'react';
import L from 'leaflet';
import { createHeatmapConfig } from '@/lib/heatmapConfig';
import { type Route } from '@/hooks/useRoutes';
import { type HeatmapAnalysis } from '@/hooks/useHeatmapAnalysis';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, Layers, Map as MapIcon } from 'lucide-react';

// Fix for default markers in React-Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});



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
  setMapCenter: (point: [number, number]) => void;
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
    return { color: 'black', fillColor: 'var(--color-accent)', fillOpacity: 0.02 };
  }
  
  const intensity = distance / maxDistance;
  
  if (intensity > 0.8) {
    return { color: 'var(--color-destructive)', fillColor: 'var(--color-destructive)', fillOpacity: 0.6 }; // High intensity red
  } else if (intensity > 0.6) {
    return { color: 'var(--color-primary)', fillColor: 'var(--color-primary)', fillOpacity: 0.5 }; // Energetic orange
  } else if (intensity > 0.4) {
    return { color: 'var(--color-emerging)', fillColor: 'var(--color-emerging-light)', fillOpacity: 0.4 }; // Emerging yellow
  } else if (intensity > 0.2) {
    return { color: 'var(--color-success)', fillColor: 'var(--color-success)', fillOpacity: 0.3 }; // Medium green
  } else {
    return { color: 'var(--color-success)', fillColor: 'var(--color-success)', fillOpacity: 0.2 }; // Low intensity green
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

export function HookSetMapCenter({setMapCenter}: { setMapCenter: (center: [number, number]) => void }) {
  const map = useMapEvents({
    moveend: () => {
      const center = map.getCenter();
      setMapCenter([center.lat, center.lng]);
    },
  });

  return null;
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
  onHeatmapModeChange,
  setMapCenter,
}: MapProps) {
  const [showHeatmap, setShowHeatmap] = useState(true);

  return (
    <Card className="h-full shadow-medium border-border/50 flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <MapIcon className="h-5 w-5 text-primary" />
            Route Map
          </CardTitle>
          <div className="flex items-center gap-3">
            <Button 
              variant={showHeatmap ? "speed" : "outline"} 
              size="sm"
              onClick={() => setShowHeatmap(!showHeatmap)}
            >
              {showHeatmap ? <Eye className="h-3 w-3 mr-1" /> : <EyeOff className="h-3 w-3 mr-1" />}
              Heatmap
            </Button>
            {/* per-route heatmap should only be enabled on local dev deployments*/}
            {/*<Button*/}
            {/*  variant={heatmapMode === 'per-route' ? "accent" : "outline"}*/}
            {/*  size="sm"*/}
            {/*  onClick={() => onHeatmapModeChange(heatmapMode === 'general' ? 'per-route' : 'general')}*/}
            {/*  disabled={heatmapMode === 'per-route' && !route?.routeHeatmap}*/}
            {/*>*/}
            {/*  <Layers className="h-3 w-3 mr-1" />*/}
            {/*  {heatmapMode === 'general' ? 'Route View' : 'General View'}*/}
            {/*</Button>*/}
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground min-w-max">Resolution:</span>
              <div className="w-20">
                <Slider
                  value={[heatmapSizeKm]}
                  onValueChange={(value) => onHeatmapSizeChange(value[0])}
                  max={5}
                  min={0.5}
                  step={0.5}
                  className="w-full"
                />
              </div>
              <Badge variant="outline" className="text-xs min-w-max">
                {heatmapSizeKm}km
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 relative flex-1 flex flex-col">
        <div className="flex-1 relative overflow-hidden">
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
                color="#ea580c"
                weight={3.5}
                opacity={0.7}
              />
            )}
            
            {/* Fit bounds to heatmap analysis area */}
            <FitBounds heatmapAnalysis={heatmapAnalysis || null} heatmapSizeKm={heatmapSizeKm} />
            <HookSetMapCenter setMapCenter={setMapCenter} />
          </MapContainer>
        </div>
      </CardContent>
    </Card>
  );
}
