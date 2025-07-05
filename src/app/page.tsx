'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues with Leaflet
const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <p>Loading map...</p>
});

export default function Home() {
  const [activeTab, setActiveTab] = useState<'recent' | 'saved'>('recent');

  const mockRecentRoutes = [
    { id: 1, name: 'Morning Loop', distance: '5.2 km', lastDone: '2 days ago' },
    { id: 2, name: 'Hill Climb', distance: '8.1 km', lastDone: '1 week ago' },
    { id: 3, name: 'River Path', distance: '3.7 km', lastDone: '3 days ago' },
  ];

  const mockSavedRoutes = [
    { id: 1, name: 'Epic Mountain Trail', distance: '12.4 km', elevation: '450m' },
    { id: 2, name: 'Coastal Route', distance: '18.2 km', elevation: '120m' },
    { id: 3, name: 'Forest Loop', distance: '7.8 km', elevation: '200m' },
    { id: 4, name: 'City Circuit', distance: '15.1 km', elevation: '80m' },
  ];

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
          <div className="space-y-4">
            {activeTab === 'recent' && mockRecentRoutes.map((route) => (
              <div key={route.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h3 className="font-medium text-gray-900">{route.name}</h3>
                <p className="text-sm text-gray-600">{route.distance}</p>
                <p className="text-sm text-gray-500">Last done: {route.lastDone}</p>
              </div>
            ))}
            
            {activeTab === 'saved' && mockSavedRoutes.map((route) => (
              <div key={route.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <h3 className="font-medium text-gray-900">{route.name}</h3>
                <p className="text-sm text-gray-600">{route.distance}</p>
                <p className="text-sm text-gray-500">Elevation: {route.elevation}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right Pane - Map */}
      <div className="w-1/2 bg-gray-100">
        <Map center={[51.505, -0.09]} zoom={13} />
      </div>
    </div>
  );
}
