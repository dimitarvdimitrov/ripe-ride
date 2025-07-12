import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { MapPin, Mountain, Filter, TrendingUp } from 'lucide-react';

interface RouteFiltersProps {
  activeTab: 'recent' | 'saved';
  onTabChange: (tab: 'recent' | 'saved') => void;
  distanceRange: [number, number];
  elevationRange: [number, number];
  onDistanceRangeChange: (range: [number, number]) => void;
  onElevationRangeChange: (range: [number, number]) => void;
  heatmapAnalysis: {
    routesProcessed: number;
    stats: {
      totalCells: number;
      totalDistance: number;
    };
  };
}

const RouteFilters: React.FC<RouteFiltersProps> = ({
  activeTab,
  onTabChange,
  distanceRange,
  elevationRange,
  onDistanceRangeChange,
  onElevationRangeChange,
  heatmapAnalysis
}) => {
  const handleTabChange = (value: string) => {
    if (value === 'recent' || value === 'saved') {
      onTabChange(value);
    }
  };

  return (
    <div className="space-y-4">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <TabsList className="grid w-full grid-cols-2 bg-muted/50">
          <TabsTrigger value="recent" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <TrendingUp className="h-4 w-4 mr-2" />
            Recently Done
          </TabsTrigger>
          <TabsTrigger value="saved" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <MapPin className="h-4 w-4 mr-2" />
            Saved Routes
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Card className="shadow-md border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground">Distance</label>
              <Badge variant="outline" className="text-xs">
                {distanceRange[0]}-{distanceRange[1]}km
              </Badge>
            </div>
            <Slider
              value={distanceRange}
              onValueChange={onDistanceRangeChange}
              max={200}
              min={0}
              step={5}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>0km</span>
              <span>200km</span>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-foreground">Elevation</label>
              <Badge variant="outline" className="text-xs">
                {elevationRange[0]}-{elevationRange[1]}m
              </Badge>
            </div>
            <Slider
              value={elevationRange}
              onValueChange={onElevationRangeChange}
              max={2000}
              min={0}
              step={50}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>0m</span>
              <span>2000m</span>
            </div>
          </div>

          <Button 
            variant="outline" 
            size="sm" 
            className="w-full"
            onClick={() => {
              onDistanceRangeChange([0, 200]);
              onElevationRangeChange([0, 2000]);
            }}
          >
            Reset Filters
          </Button>
        </CardContent>
      </Card>

      {heatmapAnalysis && (
        <Card className="shadow-md border-border/50 bg-gradient-to-r from-primary to-accent text-white">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Mountain className="h-8 w-8" />
              <div>
                <div className="text-sm font-medium">
                  {heatmapAnalysis.routesProcessed} {activeTab} routes analyzed
                </div>
                <div className="text-xs opacity-90">
                  {heatmapAnalysis.stats.totalCells} heatmap cells with routes
                </div>
                <div className="text-xs opacity-90">
                  {(heatmapAnalysis.stats.totalDistance / 1000).toFixed(1)}km total distance
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default RouteFilters;
