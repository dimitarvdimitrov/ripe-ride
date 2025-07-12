import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Mountain, Clock, Star, AlertTriangle } from 'lucide-react';
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
  const getDiversityType = (overlapScore?: number): 'Explore' | 'Familiar' | 'Routine' => {
    if (overlapScore === undefined) return 'Explore'; // Default for routes without overlap data
    
    if (overlapScore < 0.33) {
      return 'Explore'; // Very diverse routes
    } else if (overlapScore < 0.67) {
      return 'Familiar'; // Moderately diverse routes
    } else {
      return 'Routine'; // Less diverse routes (high overlap)
    }
  };

  const getDiversityColor = (diversityType: string) => {
    switch (diversityType) {
      case 'Explore': return 'bg-success text-white';
      case 'Familiar': return 'bg-primary text-white';
      case 'Routine': return 'bg-destructive text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const getEstimatedDuration = (distance?: number): string => {
    if (!distance) return '0h 0m';
    const distanceKm = distance / 1000;
    // Estimate based on 18 km/h average cycling speed
    const hours = distanceKm / 18;
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return `${h}h ${m}m`;
  };

  const shouldShowStar = (route: Route): boolean => {
    // Show star for routes with good diversity score or recently done
    return route.lastDone !== undefined || (route.overlapScore !== undefined && route.overlapScore < 0.5);
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

  const diversityType = getDiversityType(route.overlapScore);
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
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors truncate mb-2">
              {route.name}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge 
                className={cn("text-xs px-2 py-1 font-medium", getDiversityColor(diversityType))}
              >
                {diversityType}
              </Badge>
              {route.lastDone && (
                <Badge variant="secondary" className="text-xs px-2 py-1">
                  Recent
                </Badge>
              )}
            </div>
          </div>
          {shouldShowStar(route) && (
            <Star className="h-5 w-5 text-primary fill-primary flex-shrink-0" />
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="flex flex-col items-center text-center">
            <MapPin className="h-4 w-4 text-muted-foreground mb-1" />
            <span className="text-sm font-medium text-foreground">
              {route.distance ? `${(route.distance / 1000).toFixed(1)}` : '0.0'}
            </span>
            <span className="text-xs text-muted-foreground">km</span>
          </div>
          <div className="flex flex-col items-center text-center">
            <Mountain className="h-4 w-4 text-muted-foreground mb-1" />
            <span className="text-sm font-medium text-foreground">
              {route.elevation ? `${Math.round(route.elevation)}m` : 'Unknown'}
            </span>
            <span className="text-xs text-muted-foreground">elevation</span>
          </div>
          <div className="flex flex-col items-center text-center">
            <Clock className="h-4 w-4 text-muted-foreground mb-1" />
            <span className="text-sm font-medium text-foreground">
              {getEstimatedDuration(route.distance)}
            </span>
            <span className="text-xs text-muted-foreground">duration</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default RouteCard;