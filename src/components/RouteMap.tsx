import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { 
  Map, 
  ZoomIn, 
  ZoomOut, 
  Layers, 
  Navigation, 
  RotateCcw,
  Eye,
  EyeOff
} from 'lucide-react';

const RouteMap: React.FC = () => {
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [radius, setRadius] = useState([5]);

  return (
    <Card className="h-full shadow-medium border-border/50">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Map className="h-5 w-5 text-primary" />
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
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground min-w-max">Radius:</span>
              <div className="w-20">
                <Slider
                  value={radius}
                  onValueChange={setRadius}
                  max={20}
                  min={1}
                  step={1}
                  className="w-full"
                />
              </div>
              <Badge variant="outline" className="text-xs min-w-max">
                {radius[0]}km
              </Badge>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0 relative">
        {/* Map placeholder with interactive elements */}
        <div className="h-[600px] bg-gradient-to-br from-accent/10 to-primary/10 relative overflow-hidden">
          {/* Simulated map background */}
          <div className="absolute inset-0 opacity-30">
            <svg className="w-full h-full" viewBox="0 0 100 100">
              <path d="M10,20 Q20,10 30,20 T50,20 T70,20 T90,20" stroke="#e2e8f0" strokeWidth="0.5" fill="none"/>
              <path d="M20,30 Q30,20 40,30 T60,30 T80,30" stroke="#e2e8f0" strokeWidth="0.5" fill="none"/>
              <path d="M15,40 Q25,30 35,40 T55,40 T75,40 T95,40" stroke="#e2e8f0" strokeWidth="0.5" fill="none"/>
            </svg>
          </div>
          
          {/* Route paths */}
          <svg className="absolute inset-0 w-full h-full">
            <path 
              d="M100,300 Q200,250 300,300 T500,280 T700,320 T900,300" 
              stroke="hsl(var(--primary))" 
              strokeWidth="3" 
              fill="none" 
              className="opacity-80"
            />
            <path 
              d="M150,200 Q250,150 350,200 T550,180 T750,220 T950,200" 
              stroke="hsl(var(--accent))" 
              strokeWidth="2" 
              fill="none" 
              className="opacity-60"
            />
            <path 
              d="M80,400 Q180,350 280,400 T480,380 T680,420 T880,400" 
              stroke="hsl(var(--success))" 
              strokeWidth="2" 
              fill="none" 
              className="opacity-60"
            />
          </svg>

          {/* Heatmap overlay */}
          {showHeatmap && (
            <div className="absolute inset-0">
              <div className="absolute top-1/4 left-1/3 w-20 h-20 bg-primary/20 rounded-full blur-sm"></div>
              <div className="absolute top-1/2 left-1/2 w-16 h-16 bg-accent/30 rounded-full blur-sm"></div>
              <div className="absolute top-3/4 left-1/4 w-12 h-12 bg-success/20 rounded-full blur-sm"></div>
              <div className="absolute top-1/3 right-1/3 w-14 h-14 bg-primary/25 rounded-full blur-sm"></div>
            </div>
          )}

          {/* Map controls */}
          <div className="absolute top-4 right-4 flex flex-col gap-2">
            <Button variant="outline" size="icon" className="bg-background/80 backdrop-blur-sm">
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="bg-background/80 backdrop-blur-sm">
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="bg-background/80 backdrop-blur-sm">
              <Layers className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="bg-background/80 backdrop-blur-sm">
              <Navigation className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="bg-background/80 backdrop-blur-sm">
              <RotateCcw className="h-4 w-4" />
            </Button>
          </div>

          {/* Route markers */}
          <div className="absolute top-1/3 left-1/2 w-3 h-3 bg-primary rounded-full shadow-glow animate-pulse"></div>
          <div className="absolute top-1/2 left-1/3 w-3 h-3 bg-accent rounded-full shadow-glow animate-pulse" style={{ animationDelay: '0.5s' }}></div>
          <div className="absolute top-2/3 left-2/3 w-3 h-3 bg-success rounded-full shadow-glow animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>

        {/* Map legend */}
        <div className="absolute bottom-4 left-4 bg-background/90 backdrop-blur-sm rounded-lg p-3 shadow-soft">
          <div className="text-xs font-medium mb-2">Route Types</div>
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-0.5 bg-primary rounded"></div>
              <span>Primary Routes</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-0.5 bg-accent rounded"></div>
              <span>Alternative Routes</span>
            </div>
            <div className="flex items-center gap-2 text-xs">
              <div className="w-3 h-0.5 bg-success rounded"></div>
              <span>Easy Routes</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RouteMap;