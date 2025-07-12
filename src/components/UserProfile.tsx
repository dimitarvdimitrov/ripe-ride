import React from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LogOut, Settings, Trophy, Zap } from 'lucide-react';
import { signOut } from 'next-auth/react';

interface UserProfileProps {
  user: {
    name: string;
    image?: string;
    stats?: {
      totalRoutes: number;
      totalDistance: string;
      totalElevation: string;
    };
  };
}

const UserProfile: React.FC<UserProfileProps> = ({ user }) => {
  const defaultStats = {
    totalRoutes: 0,
    totalDistance: '0km',
    totalElevation: '0m'
  };
  
  const stats = user.stats || defaultStats;

  return (
    <Card className="shadow-md border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-3 mb-4">
          <Avatar className="h-12 w-12 ring-2 ring-primary/20">
            <AvatarImage src={user.image} alt={user.name} />
            <AvatarFallback className="bg-gradient-to-r from-primary to-accent text-white font-semibold">
              {user.name.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h2 className="font-semibold text-foreground">{user.name}</h2>
            <Badge variant="outline" className="text-xs mt-1">
              <Zap className="h-3 w-3 mr-1" />
              Connected to Strava
            </Badge>
          </div>
          <Button variant="ghost" size="icon" className="text-muted-foreground">
            <Settings className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="text-center">
            <div className="text-lg font-bold text-primary">{stats.totalRoutes}</div>
            <div className="text-xs text-muted-foreground">Routes</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-accent">{stats.totalDistance}</div>
            <div className="text-xs text-muted-foreground">Distance</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold text-success">{stats.totalElevation}</div>
            <div className="text-xs text-muted-foreground">Elevation</div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="accent" size="sm" className="flex-1">
            <Trophy className="h-3 w-3 mr-1" />
            Achievements
          </Button>
          <Button variant="outline" size="sm" onClick={() => signOut()}>
            <LogOut className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default UserProfile;