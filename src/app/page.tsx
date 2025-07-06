'use client';

import { useState, useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useGridAnalysis } from '@/hooks/useGridAnalysis';

// Simple debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

// Dynamic import to avoid SSR issues with Leaflet
const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <p>Loading map...</p>
});

interface Route {
  id: string;
  name: string;
  distance: string;
  elevation: string;
  lastDone?: string;
  points: { lat: number; lon: number; elevation?: number }[];
  error?: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'recent' | 'saved'>('recent');
  const [recentRoutes, setRecentRoutes] = useState<Route[]>([]);
  const [savedRoutes, setSavedRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [gridSizeKm, setGridSizeKm] = useState(5); // Page decides grid size
  
  // Filter states
  const [distanceRange, setDistanceRange] = useState<[number, number]>([0, 200]); // km
  const [elevationRange, setElevationRange] = useState<[number, number]>([0, 2000]); // meters

  // Debounce grid size to prevent excessive requests
  const debouncedGridSize = useDebounce(gridSizeKm, 100);
  
  // Use React Query for grid analysis
  const {
    data: gridAnalysis,
    isLoading: loadingGrid,
    error: gridError
  } = useGridAnalysis(
    activeTab,
    debouncedGridSize,
    !loading && (recentRoutes.length > 0 || savedRoutes.length > 0) // Only enable when routes are loaded
  );

  useEffect(() => {
    const fetchRoutes = async () => {
      try {
        const [recentResponse, savedResponse] = await Promise.all([
          fetch('/api/routes?folder=recent'),
          fetch('/api/routes?folder=saved')
        ]);

        if (recentResponse.ok && savedResponse.ok) {
          const recent = await recentResponse.json();
          const saved = await savedResponse.json();
          setRecentRoutes(recent);
          setSavedRoutes(saved);
        }
      } catch (error) {
        console.error('Error fetching routes:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRoutes();
  }, []);

  const hasCurrentAnalysis = gridAnalysis !== undefined;

  return (
    <div className="h-screen flex">
      {/* Left Pane - Routes */}
      <div className="w-1/4 bg-gray-50 border-r border-gray-200 flex flex-col">
        {/* Tab Navigation */}
        <div className="border-b border-gray-200 bg-white">
          <nav className="flex space-x-8 px-6 py-4">
            <button
              onClick={() => setActiveTab('recent')}
              className={`px-3 py-2 text-sm font-medium rounded-md ${
                activeTab === 'recent'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Recently Done
            </button>
            <button
              onClick={() => setActiveTab('saved')}
              className={`px-3 py-2 text-sm font-medium rounded-md ${
                activeTab === 'saved'
                  ? 'bg-blue-100 text-blue-700'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Saved Routes
            </button>
          </nav>
        </div>

        {/* Filter Controls */}
        <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
          <div className="space-y-4">
            {/* Distance Filter */}
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-700 min-w-0 flex-shrink-0">
                Distance: {distanceRange[0]}-{distanceRange[1]}km
              </label>
              <div className="dual-range-container flex-1 ml-3">
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={distanceRange[0]}
                  onChange={(e) => setDistanceRange([Number(e.target.value), distanceRange[1]])}
                  className="absolute w-full appearance-none cursor-pointer slider-thumb-blue"
                />
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="1"
                  value={distanceRange[1]}
                  onChange={(e) => setDistanceRange([distanceRange[0], Number(e.target.value)])}
                  className="absolute w-full appearance-none cursor-pointer slider-thumb-blue"
                />
              </div>
            </div>

            {/* Elevation Filter */}
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-gray-700 min-w-0 flex-shrink-0">
                Elevation: {elevationRange[0]}-{elevationRange[1]}m
              </label>
              <div className="dual-range-container flex-1 ml-3">
                <input
                  type="range"
                  min="0"
                  max="2000"
                  step="50"
                  value={elevationRange[0]}
                  onChange={(e) => setElevationRange([Number(e.target.value), elevationRange[1]])}
                  className="absolute w-full appearance-none cursor-pointer slider-thumb-green"
                />
                <input
                  type="range"
                  min="0"
                  max="2000"
                  step="50"
                  value={elevationRange[1]}
                  onChange={(e) => setElevationRange([elevationRange[0], Number(e.target.value)])}
                  className="absolute w-full appearance-none cursor-pointer slider-thumb-green"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Route List */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Grid Analysis Status */}
          {hasCurrentAnalysis && gridAnalysis && (
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-md p-3">
              <div className="text-xs text-blue-800">
                <p>📊 {gridAnalysis.routesProcessed} {activeTab} routes analyzed</p>
                <p>🎯 {gridAnalysis.stats.totalGrids} grid squares with routes</p>
                <p>📏 {(gridAnalysis.stats.totalDistance / 1000).toFixed(1)}km total distance</p>
              </div>
            </div>
          )}
          
          {loadingGrid && (
            <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <div className="text-xs text-yellow-800">
                <p>⏳ Analyzing grid density...</p>
              </div>
            </div>
          )}
          
          {gridError && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
              <div className="text-xs text-red-800">
                <p>❌ Failed to analyze grid: {gridError.message}</p>
              </div>
            </div>
          )}
          
          {loading ? (
            <div className="flex justify-center items-center h-32">
              <p className="text-gray-500">Loading routes...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {activeTab === 'recent' && recentRoutes.map((route) => (
                <div 
                  key={route.id} 
                  className={`bg-white p-4 rounded-lg shadow-sm border cursor-pointer hover:shadow-md transition-shadow ${
                    route.error 
                      ? 'border-red-200 bg-red-50' 
                      : 'border-gray-200'
                  } ${
                    selectedRoute?.id === route.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => {
                    console.log(`📍 Selected route: ${route.name} (${route.points.length} points)`);
                    setSelectedRoute(route);
                  }}
                >
                  <h3 className="font-medium text-gray-900">{route.name}</h3>
                  <p className="text-sm text-gray-600">{route.distance}</p>
                  <p className="text-sm text-gray-500">Last done: {route.lastDone}</p>
                  {route.error && (
                    <p className="text-sm text-red-600 mt-2">⚠️ {route.error}</p>
                  )}
                </div>
              ))}
              
              {activeTab === 'saved' && savedRoutes.map((route) => (
                <div 
                  key={route.id} 
                  className={`bg-white p-4 rounded-lg shadow-sm border cursor-pointer hover:shadow-md transition-shadow ${
                    route.error 
                      ? 'border-red-200 bg-red-50' 
                      : 'border-gray-200'
                  } ${
                    selectedRoute?.id === route.id ? 'ring-2 ring-blue-500' : ''
                  }`}
                  onClick={() => {
                    console.log(`📍 Selected route: ${route.name} (${route.points.length} points)`);
                    setSelectedRoute(route);
                  }}
                >
                  <h3 className="font-medium text-gray-900">{route.name}</h3>
                  <p className="text-sm text-gray-600">{route.distance}</p>
                  <p className="text-sm text-gray-500">Elevation: {route.elevation}</p>
                  {route.error && (
                    <p className="text-sm text-red-600 mt-2">⚠️ {route.error}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Pane - Map */}
      <div className="w-3/4 bg-gray-100">
        <Map 
          center={selectedRoute && selectedRoute.points.length > 0 
            ? [selectedRoute.points[0].lat, selectedRoute.points[0].lon] 
            : [52.3676, 4.9041]} 
          zoom={13}
          route={selectedRoute}
          gridAnalysis={gridAnalysis}
          gridSizeKm={gridSizeKm}
          onGridSizeChange={setGridSizeKm}
        />
      </div>
    </div>
  );
}
