import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Mountain, Clock, Activity, Play, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Route } from '@/hooks/useRoutes';

interface RouteCardProps {
  route: Route;
  className?: string;
  onSelect?: (route: Route) => void;
  isSelected?: boolean;
  showOverlapScore?: boolean;
  minOverlapScore?: number;
  maxOverlapScore?: number;
}

const RouteCard: React.FC<RouteCardProps> = ({ 
  route, 
  className, 
  onSelect, 
  isSelected = false,
  showOverlapScore = false,
  minOverlapScore = 0,
  maxOverlapScore = 1
}) => {
  const getDifficultyFromDistance = (distance?: number): 'Easy' | 'Medium' | 'Hard' => {
    if (!distance) return 'Easy';
    const distanceKm = distance / 1000;
    if (distanceKm < 30) return 'Easy';
    if (distanceKm < 60) return 'Medium';
    return 'Hard';
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'Easy': return 'bg-success/10 text-success border-success/20';
      case 'Medium': return 'bg-primary/10 text-primary border-primary/20';
      case 'Hard': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getOverlapScoreStyle = (score: number) => {
    if (!showOverlapScore || score === undefined) return { color: 'bg-gray-500', icon: '○' };
    
    const range = maxOverlapScore - minOverlapScore;
    const normalizedScore = range === 0 ? 0 : (score - minOverlapScore) / range;
    
    if (normalizedScore < 0.33) {
      return { color: 'bg-success', icon: '★' }; // Most diverse (lowest overlap)
    } else if (normalizedScore < 0.67) {
      return { color: 'bg-primary', icon: '◐' }; // Moderately diverse
    } else {
      return { color: 'bg-destructive', icon: '○' }; // Least diverse (highest overlap)
    }
  };

  // Handle error routes
  if (route.error) {
    return (
      <Card className={cn("group border-destructive/20 bg-destructive/5", className)}>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-foreground truncate">{route.name}</h3>
              <p className="text-sm text-destructive mt-1">Parse Error</p>
              <p className="text-xs text-muted-foreground mt-1 break-words">{route.error}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const difficulty = getDifficultyFromDistance(route.distance);
  const overlapStyle = getOverlapScoreStyle(route.overlapScore || 0);

  return (
    <Card 
      className={cn(
        "group hover:shadow-lg transition-all duration-300 cursor-pointer hover:-translate-y-1 border-border/50",
        isSelected && "ring-2 ring-primary",
        className
      )}
      onClick={() => onSelect?.(route)}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">
              {route.name}
            </h3>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge 
                variant="outline" 
                className={cn("text-xs", getDifficultyColor(difficulty))}
              >
                {difficulty}
              </Badge>
              {route.lastDone && (
                <Badge variant="secondary" className="text-xs">
                  Recent
                </Badge>
              )}
            </div>
          </div>
          {showOverlapScore && route.overlapScore !== undefined && (
            <div className="ml-2 flex flex-col items-center flex-shrink-0">
              <div className="text-xs text-muted-foreground mb-1">Diversity</div>
              <div className={cn(
                "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white",
                overlapStyle.color
              )}>
                {overlapStyle.icon}
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <MapPin className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">
              {route.distance ? `${(route.distance / 1000).toFixed(1)} km` : 'Unknown distance'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mountain className="h-4 w-4 flex-shrink-0" />
            <span className="truncate">
              {route.elevation ? `${Math.round(route.elevation)}m` : 'Unknown elevation'}
            </span>
          </div>
          {route.lastDone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground col-span-2">
              <Clock className="h-4 w-4 flex-shrink-0" />
              <span className="truncate">Last done: {route.lastDone}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <Button variant="speed" size="sm" className="flex-1">
            <Play className="h-3 w-3 mr-1" />
            View Route
          </Button>
          <Button variant="outline" size="sm">
            <Activity className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default RouteCard;