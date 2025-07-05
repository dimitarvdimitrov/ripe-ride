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

export default function Home() {
  const [activeTab, setActiveTab] = useState<'recent' | 'saved'>('recent');
  const [recentRoutes, setRecentRoutes] = useState<Route[]>([]);
  const [savedRoutes, setSavedRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);

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

  return (
    <div className="h-screen flex">
      {/* Left Pane - Routes */}
      <div className="w-1/2 bg-gray-50 border-r border-gray-200 flex flex-col">
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
      <div className="w-1/2 bg-gray-100">
        <Map 
          center={selectedRoute && selectedRoute.points.length > 0 
            ? [selectedRoute.points[0].lat, selectedRoute.points[0].lon] 
            : [52.3676, 4.9041]} 
          zoom={13}
          route={selectedRoute}
        />
      </div>
    </div>
  );
}
