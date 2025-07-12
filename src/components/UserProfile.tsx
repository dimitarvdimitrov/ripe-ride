import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LogOut, Settings, Zap, RefreshCw } from 'lucide-react';
import { signOut } from 'next-auth/react';

interface UserProfileProps {
  user: {
    name: string;
    avatar?: string;
    connectedTo?: string;
    stats: {
      totalRoutes: number;
      totalDistance: string;
      totalElevation: string;
    };
  };
  onSync?: () => void;
  isSyncing?: boolean;
}

const UserProfile: React.FC<UserProfileProps> = ({ user, onSync, isSyncing }) => {
  return (
    <Card className="shadow-soft border-border/50">
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <Avatar className="h-10 w-10 ring-2 ring-primary/20">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback className="bg-gradient-speed text-white font-semibold">
              {user.name.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h2 className="font-semibold text-foreground text-sm">{user.name}</h2>
            {user.connectedTo && (
              <Badge variant="outline" className="text-xs mt-1">
                <Zap className="h-3 w-3 mr-1" />
                Connected to {user.connectedTo}
              </Badge>
            )}
          </div>
          <div className="flex flex-col gap-1">
            {onSync && (
              <Button 
                variant="outline" 
                size="icon" 
                className="h-8 w-8" 
                onClick={onSync}
                disabled={isSyncing}
                title="Sync routes from Strava"
              >
                <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin' : ''}`} />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="text-muted-foreground h-8 w-8">
              <Settings className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => signOut()}>
              <LogOut className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <div className="text-center">
            <div className="text-sm font-bold text-primary">{user.stats.totalRoutes}</div>
            <div className="text-xs text-muted-foreground">Routes</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-accent">{user.stats.totalDistance}</div>
            <div className="text-xs text-muted-foreground">Distance</div>
          </div>
          <div className="text-center">
            <div className="text-sm font-bold text-success">{user.stats.totalElevation}</div>
            <div className="text-xs text-muted-foreground">Elevation</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default UserProfile;