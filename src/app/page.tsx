'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

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
  routesProcessed: number;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState<'recent' | 'saved'>('recent');
  const [recentRoutes, setRecentRoutes] = useState<Route[]>([]);
  const [savedRoutes, setSavedRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [gridSizeKm, setGridSizeKm] = useState(4); // Page decides grid size

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

  // Cache keys for browser storage
  const getCacheKey = (folder: 'recent' | 'saved', gridSizeKm: number) => `grid-analysis-${folder}-${gridSizeKm}`;
  
  // Get cached analysis from sessionStorage
  const getCachedAnalysis = (folder: 'recent' | 'saved', gridSizeKm: number): GridAnalysis | null => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = sessionStorage.getItem(getCacheKey(folder, gridSizeKm));
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  };
  
  // Save analysis to sessionStorage
  const setCachedAnalysis = (folder: 'recent' | 'saved', analysis: GridAnalysis) => {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(getCacheKey(folder, analysis.gridConfig.gridSizeKm), JSON.stringify(analysis));
      // Force a re-render by updating a dummy state
      setLoadingGrid(false);
    } catch (error) {
      console.error('Failed to cache analysis:', error);
    }
  };

  const fetchGridAnalysis = async (folder: 'recent' | 'saved') => {
    setLoadingGrid(true);
    try {
      // Check cache first
      const cached = getCachedAnalysis(folder, gridSizeKm);
      if (cached) {
        console.log(`📊 Using cached grid analysis for ${folder}:`, cached);
        setLoadingGrid(false);
        return;
      }
      
      // Fetch analysis for specific folder only
      const includeRecent = folder === 'recent' ? 'true' : 'false';
      const includeSaved = folder === 'saved' ? 'true' : 'false';
      
      const response = await fetch(`/api/grid-analysis?recent=${includeRecent}&saved=${includeSaved}&gridSize=${gridSizeKm}`);
      if (response.ok) {
        const analysis = await response.json();
        setCachedAnalysis(folder, analysis);
        console.log(`📊 Grid analysis fetched and cached for ${folder}:`, analysis);
      }
    } catch (error) {
      console.error(`Error fetching grid analysis for ${folder}:`, error);
    } finally {
      setLoadingGrid(false);
    }
  };

  // Get current grid analysis based on active tab
  const currentGridAnalysis = getCachedAnalysis(activeTab, gridSizeKm);
  const hasCurrentAnalysis = currentGridAnalysis !== null;

  return (
    <div className="h-screen flex">
      {/* Left Pane - Routes */}
      <div className="w-1/3 bg-gray-50 border-r border-gray-200 flex flex-col">
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

        {/* Route List */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Grid Analysis Button */}
          <div className="mb-4">
            <button
              onClick={() => fetchGridAnalysis(activeTab)}
              disabled={loadingGrid}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
            >
              {loadingGrid ? 'Loading Grid Analysis...' : `Analyze ${activeTab === 'recent' ? 'Recent' : 'Saved'} Routes`}
            </button>
            {hasCurrentAnalysis && currentGridAnalysis && (
              <div className="mt-2 text-xs text-gray-600">
                <p>📊 {currentGridAnalysis.routesProcessed} {activeTab} routes processed</p>
                <p>🎯 {currentGridAnalysis.stats.totalGrids} grid squares with routes</p>
                <p>📏 {(currentGridAnalysis.stats.totalDistance / 1000).toFixed(1)}km total distance</p>
              </div>
            )}
          </div>
          
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
      <div className="w-2/3 bg-gray-100">
        <Map 
          center={selectedRoute && selectedRoute.points.length > 0 
            ? [selectedRoute.points[0].lat, selectedRoute.points[0].lon] 
            : [52.3676, 4.9041]} 
          zoom={13}
          route={selectedRoute}
          gridAnalysis={currentGridAnalysis}
        />
      </div>
    </div>
  );
}
