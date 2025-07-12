'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useHeatmapAnalysis } from '@/hooks/useHeatmapAnalysis';
import { useRoutes, Route } from '@/hooks/useRoutes';
import { useDebounce } from '@/hooks/useDebounce';
import { ScrollArea } from '@/components/ui/scroll-area';
import UserProfile from '@/components/UserProfile';
import RouteFilters from '@/components/RouteFilters';
import RouteCard from '@/components/RouteCard';

// Dynamic import to avoid SSR issues with Leaflet
const Map = dynamic(() => import('@/components/Map'), {
  ssr: false,
  loading: () => <p>Loading map...</p>
});


export default function Home() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'recent' | 'saved'>('recent');
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [heatmapSizeKm, setHeatmapSizeKm] = useState(5);
  const [heatmapMode, setHeatmapMode] = useState<'general' | 'per-route'>('general');
  const [isFirstSync, setIsFirstSync] = useState(false);
  
  // Filter states
  const [distanceRange, setDistanceRange] = useState<[number, number]>([0, 200]);
  const [elevationRange, setElevationRange] = useState<[number, number]>([0, 2000]);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'loading') return; // Still loading
    if (!session) {
      router.push('/login');
      return;
    }
  }, [session, status, router]);

  // Sync routes on first login
  useEffect(() => {
    const syncRoutes = async () => {
      // TODO we need to have this logic in the backend - on the login endpoint.
      // TODO we need to be able to call sync-routes via a button too on the main page instead of using the react state to control it
      if (session && !isFirstSync) {
        setIsFirstSync(true);
        try {
          console.log('🔄 First login detected, syncing routes...');
          const response = await fetch('/api/sync-routes', {
            method: 'POST',
          });
          
          if (response.ok) {
            const result = await response.json();
            console.log(`✅ Synced ${result.syncedCount} routes from Strava`);
          }
        } catch (error) {
          console.error('❌ Failed to sync routes:', error);
        }
      }
    };

    syncRoutes();
  }, [session, isFirstSync]);

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

  // Show loading screen while checking authentication
  if (status === 'loading') {
    return (
      <div className="h-screen flex items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  // Don't render anything if not authenticated (will redirect)
  if (!session) {
    return null;
  }

  // For per-route mode, use the selected route's heatmap data
  const currentHeatmapAnalysis = heatmapMode === 'per-route' ? selectedRoute?.routeHeatmap : heatmapAnalysis;

  // Separate routes by error status
  const validRecentRoutes = recentRoutes.filter(route => !route.error);
  const errorRecentRoutes = recentRoutes.filter(route => route.error);
  const validSavedRoutes = savedRoutes.filter(route => !route.error);
  const errorSavedRoutes = savedRoutes.filter(route => route.error);

  // Calculate min/max overlap scores for dynamic coloring (only for valid routes)
  const routesWithScores = validSavedRoutes.filter(route => route.overlapScore !== undefined);
  const overlapScores = routesWithScores.map(route => route.overlapScore!);
  const minOverlapScore = overlapScores.length > 0 ? Math.min(...overlapScores) : 0;
  const maxOverlapScore = overlapScores.length > 0 ? Math.max(...overlapScores) : 1;
  


  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-[1600px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-2rem)]">
          {/* Left Sidebar */}
          <div className="lg:col-span-1 space-y-6">
            <UserProfile 
              user={{
                name: session.user?.name || 'Strava User',
                image: session.user?.image,
                stats: {
                  totalRoutes: validRecentRoutes.length + validSavedRoutes.length,
                  totalDistance: `${Math.round(
                    ([...validRecentRoutes, ...validSavedRoutes]
                      .reduce((sum, route) => sum + (route.distance || 0), 0)) / 1000
                  )}km`,
                  totalElevation: `${Math.round(
                    [...validRecentRoutes, ...validSavedRoutes]
                      .reduce((sum, route) => sum + (route.elevation || 0), 0)
                  )}m`
                }
              }}
            />
            <RouteFilters
              activeTab={activeTab}
              onTabChange={setActiveTab}
              distanceRange={distanceRange}
              elevationRange={elevationRange}
              onDistanceRangeChange={setDistanceRange}
              onElevationRangeChange={setElevationRange}
              heatmapAnalysis={heatmapAnalysis}
            />
          </div>

          {/* Route List */}
          <div className="lg:col-span-1">
            <div className="h-full flex flex-col">
              <div className="flex-1">
                <ScrollArea className="h-full pr-2">
                  {/* Loading and Error States */}
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
                      <p className="text-muted-foreground">Loading routes...</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {activeTab === 'recent' && (
                        <>
                          {validRecentRoutes.map((route) => (
                            <RouteCard
                              key={route.id}
                              route={route}
                              isSelected={selectedRoute?.id === route.id}
                              onSelect={(route) => {
                                console.log(`📍 Selected route: ${route.name} (${route.points.length} points)`);
                                setSelectedRoute(route);
                              }}
                              className="animate-fade-in"
                            />
                          ))}
                          {errorRecentRoutes.map((route) => (
                            <RouteCard key={route.id} route={route} />
                          ))}
                        </>
                      )}
                      
                      {activeTab === 'saved' && (
                        <>
                          {validSavedRoutes.map((route) => (
                            <RouteCard
                              key={route.id}
                              route={route}
                              isSelected={selectedRoute?.id === route.id}
                              onSelect={(route) => {
                                console.log(`📍 Selected route: ${route.name} (${route.points.length} points)`);
                                setSelectedRoute(route);
                              }}
                              showOverlapScore={true}
                              minOverlapScore={minOverlapScore}
                              maxOverlapScore={maxOverlapScore}
                              className="animate-fade-in"
                            />
                          ))}
                          {errorSavedRoutes.map((route) => (
                            <RouteCard key={route.id} route={route} />
                          ))}
                        </>
                      )}
                      {((activeTab === 'recent' && validRecentRoutes.length === 0 && errorRecentRoutes.length === 0) ||
                        (activeTab === 'saved' && validSavedRoutes.length === 0 && errorSavedRoutes.length === 0)) && (
                        <div className="text-center py-8 text-muted-foreground">
                          <p>No routes match your current filters</p>
                        </div>
                      )}
                    </div>
                  )}
                </ScrollArea>
              </div>
            </div>
          </div>

          {/* Map Area */}
          <div className="lg:col-span-2">
            <div className="h-full rounded-lg overflow-hidden bg-card border">
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
        </div>
      </div>
    </div>
  );
}
