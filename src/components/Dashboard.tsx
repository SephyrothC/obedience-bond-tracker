import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, User, Heart, Target, Gift, Zap, LogOut } from 'lucide-react';

interface Profile {
  id: string;
  user_id: string;
  display_name: string;
  role: 'dominant' | 'submissive' | 'switch';
  avatar_url?: string;
  theme_color: string;
  created_at: string;
  updated_at: string;
}

const Dashboard = () => {
  const { user, signOut } = useAuth();

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return data as Profile;
    },
    enabled: !!user
  });

  const { data: pointsBalance } = useQuery({
    queryKey: ['points', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      
      const { data, error } = await supabase
        .from('points_transactions')
        .select('points')
        .eq('user_id', user.id);

      if (error) throw error;
      
      return data.reduce((total, transaction) => total + transaction.points, 0);
    },
    enabled: !!user
  });

  const { data: todayHabits } = useQuery({
    queryKey: ['todayHabits', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const today = new Date().toISOString().split('T')[0];
      
      const { data: habits, error: habitsError } = await supabase
        .from('habits')
        .select('*')
        .eq('assigned_to', user.id)
        .eq('is_active', true);

      if (habitsError) throw habitsError;

      const { data: completions, error: completionsError } = await supabase
        .from('habit_completions')
        .select('habit_id')
        .eq('user_id', user.id)
        .gte('completed_at', `${today}T00:00:00`);

      if (completionsError) throw completionsError;

      const completedHabitIds = new Set(completions.map(c => c.habit_id));
      
      return habits.map(habit => ({
        ...habit,
        completed: completedHabitIds.has(habit.id)
      }));
    },
    enabled: !!user
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-muted-foreground">Chargement de votre espace...</p>
        </div>
      </div>
    );
  }

  const getRoleIcon = (role: string) => {
    return role === 'dominant' ? Crown : User;
  };

  const getRoleColor = (role: string) => {
    return role === 'dominant' ? 'text-primary' : 'text-accent';
  };

  const completedHabits = todayHabits?.filter(h => h.completed).length || 0;
  const totalHabits = todayHabits?.length || 0;

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h1 className="text-3xl font-bold gradient-passion bg-clip-text text-transparent">
              Bienvenue, {profile?.display_name}
            </h1>
            <div className="flex items-center space-x-2">
              {profile && (
                <Badge variant="outline" className={`${getRoleColor(profile.role)} border-current`}>
                  {React.createElement(getRoleIcon(profile.role), { className: "w-3 h-3 mr-1" })}
                  {profile.role === 'dominant' ? 'Dominant(e)' : 'Soumis(e)'}
                </Badge>
              )}
            </div>
          </div>
          
          <Button variant="outline" onClick={signOut} className="space-x-2">
            <LogOut className="w-4 h-4" />
            <span>Déconnexion</span>
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Points totaux</CardTitle>
              <Zap className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{pointsBalance || 0}</div>
              <p className="text-xs text-muted-foreground">
                Votre dévotion récompensée
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Habitudes du jour</CardTitle>
              <Target className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {completedHabits}/{totalHabits}
              </div>
              <p className="text-xs text-muted-foreground">
                Tâches accomplies aujourd'hui
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Connexion</CardTitle>
              <Heart className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">Active</div>
              <p className="text-xs text-muted-foreground">
                Votre lien est établi
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Today's Habits */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="w-5 h-5 text-primary" />
              <span>Vos habitudes du jour</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!todayHabits || todayHabits.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Gift className="w-12 h-12 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground">Aucune habitude assignée pour aujourd'hui</p>
                <p className="text-sm text-muted-foreground">
                  {profile?.role === 'dominant' 
                    ? "Créez des habitudes pour vos soumis(es)" 
                    : "Demandez à votre Dominant(e) de vous assigner des tâches"
                  }
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {todayHabits.map((habit) => (
                  <div
                    key={habit.id}
                    className={`p-4 rounded-lg border transition-colors ${
                      habit.completed
                        ? 'bg-accent/10 border-accent/30'
                        : 'bg-card border-border hover:bg-accent/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <h3 className="font-medium">{habit.title}</h3>
                        {habit.description && (
                          <p className="text-sm text-muted-foreground">{habit.description}</p>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={habit.completed ? "default" : "outline"}>
                          {habit.points_value} pts
                        </Badge>
                        {habit.completed && (
                          <Badge className="bg-accent text-accent-foreground">
                            Accompli
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle>Actions rapides</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Button variant="outline" className="h-20 flex-col space-y-2">
                <Target className="w-6 h-6" />
                <span className="text-sm">Habitudes</span>
              </Button>
              
              <Button variant="outline" className="h-20 flex-col space-y-2">
                <Gift className="w-6 h-6" />
                <span className="text-sm">Récompenses</span>
              </Button>
              
              <Button variant="outline" className="h-20 flex-col space-y-2">
                <Zap className="w-6 h-6" />
                <span className="text-sm">Punitions</span>
              </Button>
              
              <Button variant="outline" className="h-20 flex-col space-y-2">
                <Heart className="w-6 h-6" />
                <span className="text-sm">Partenaire</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;