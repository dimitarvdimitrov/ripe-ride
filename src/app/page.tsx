'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useHeatmapAnalysis } from '@/hooks/useHeatmapAnalysis';
import { useRoutes, Route } from '@/hooks/useRoutes';
import { useDebounce } from '@/hooks/useDebounce';

// Dynamic import to avoid SSR issues with Leaflet
const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <p>Loading map...</p>
});


export default function Home() {
  const [activeTab, setActiveTab] = useState<'recent' | 'saved'>('recent');
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [heatmapSizeKm, setHeatmapSizeKm] = useState(5);
  const [heatmapMode, setHeatmapMode] = useState<'general' | 'per-route'>('general');
  
  // Filter states
  const [distanceRange, setDistanceRange] = useState<[number, number]>([0, 200]);
  const [elevationRange, setElevationRange] = useState<[number, number]>([0, 2000]);

  // Debounce values to prevent excessive requests
  const debouncedHeatmapSize = useDebounce(heatmapSizeKm, 100);
  const debouncedDistanceRange = useDebounce(distanceRange, 100);
  const debouncedElevationRange = useDebounce(elevationRange, 100);
  
  // Fetch routes using React Query with debounced filters
  const {
    data: recentRoutes = [],
    isLoading: loadingRecent,
    error: recentError
  } = useRoutes(
    'recent',
    debouncedHeatmapSize,
    debouncedDistanceRange[0],
    debouncedDistanceRange[1],
    debouncedElevationRange[0],
    debouncedElevationRange[1]
  );

  const {
    data: savedRoutes = [],
    isLoading: loadingSaved,
    error: savedError
  } = useRoutes(
    'saved',
    debouncedHeatmapSize,
    debouncedDistanceRange[0],
    debouncedDistanceRange[1],
    debouncedElevationRange[0],
    debouncedElevationRange[1]
  );

  // Use React Query for heatmap analysis - always use recent routes for general heatmap display
  const {
    data: heatmapAnalysis,
    isLoading: loadingHeatmap,
    error: heatmapError
  } = useHeatmapAnalysis(
    'recent',
    debouncedHeatmapSize,
    recentRoutes.length > 0
  );

  const loading = loadingRecent || loadingSaved;

  // For per-route mode, use the selected route's heatmap data
  const currentHeatmapAnalysis = heatmapMode === 'per-route' ? selectedRoute?.routeHeatmap : heatmapAnalysis;
  const hasCurrentAnalysis = currentHeatmapAnalysis !== undefined;

  // Calculate min/max overlap scores for dynamic coloring
  const routesWithScores = savedRoutes.filter(route => route.overlapScore !== undefined);
  const overlapScores = routesWithScores.map(route => route.overlapScore!);
  const minOverlapScore = overlapScores.length > 0 ? Math.min(...overlapScores) : 0;
  const maxOverlapScore = overlapScores.length > 0 ? Math.max(...overlapScores) : 1;
  
  // Function to get color and icon based on overlap score spectrum
  const getOverlapScoreStyle = (score: number) => {
    if (overlapScores.length === 0) return { color: 'bg-gray-500', icon: '○' };
    
    const range = maxOverlapScore - minOverlapScore;
    const normalizedScore = range === 0 ? 0 : (score - minOverlapScore) / range;
    
    if (normalizedScore < 0.33) {
      return { color: 'bg-green-500', icon: '★' }; // Most diverse (lowest overlap)
    } else if (normalizedScore < 0.67) {
      return { color: 'bg-yellow-500', icon: '◐' }; // Moderately diverse
    } else {
      return { color: 'bg-red-500', icon: '○' }; // Least diverse (highest overlap)
    }
  };

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
          {/* Heatmap Analysis Status */}
          {hasCurrentAnalysis && currentHeatmapAnalysis && (
            <div className="mb-4 bg-blue-50 border border-blue-200 rounded-md p-3">
              <div className="text-xs text-blue-800">
                <p>📊 {currentHeatmapAnalysis.routesProcessed} {heatmapMode === 'per-route' ? 'route' : 'recent routes'} analyzed</p>
                <p>🎯 {currentHeatmapAnalysis.stats.totalCells} heatmap cells with routes</p>
                <p>📏 {(currentHeatmapAnalysis.stats.totalDistance / 1000).toFixed(1)}km total distance</p>
                <p className="mt-1 text-blue-600">
                  {heatmapMode === 'per-route' 
                    ? `Showing ${selectedRoute?.name || 'selected route'} coverage`
                    : 'Heatmap shows recent route coverage only'
                  }
                </p>
              </div>
            </div>
          )}
          
          {(loadingHeatmap || loading) && (
            <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-md p-3">
              <div className="text-xs text-yellow-800">
                <p>⏳ {loadingHeatmap ? 'Analyzing heatmap density...' : 'Loading routes...'}</p>
              </div>
            </div>
          )}
          
          {(heatmapError || recentError || savedError) && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-3">
              <div className="text-xs text-red-800">
                <p>❌ Error: {heatmapError?.message || recentError?.message || savedError?.message}</p>
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
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{route.name}</h3>
                      <p className="text-sm text-gray-600">{route.distance}</p>
                      <p className="text-sm text-gray-500">Elevation: {route.elevation}</p>
                      {route.error && (
                        <p className="text-sm text-red-600 mt-2">⚠️ {route.error}</p>
                      )}
                    </div>
                    {route.overlapScore !== undefined && (
                      <div className="ml-2 flex flex-col items-center">
                        <div className="text-xs text-gray-500 mb-1">Diversity</div>
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                          getOverlapScoreStyle(route.overlapScore).color
                        }`}>
                          {getOverlapScoreStyle(route.overlapScore).icon}
                        </div>
                      </div>
                    )}
                  </div>
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
          heatmapAnalysis={currentHeatmapAnalysis}
          heatmapSizeKm={heatmapSizeKm}
          onHeatmapSizeChange={setHeatmapSizeKm}
          heatmapMode={heatmapMode}
          onHeatmapModeChange={setHeatmapMode}
        />
      </div>
    </div>
  );
}
