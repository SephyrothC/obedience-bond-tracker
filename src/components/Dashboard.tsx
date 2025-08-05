import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Crown, User, LogOut } from 'lucide-react';
import StatsCards from './dashboard/StatsCards';
import HabitsSection from './dashboard/HabitsSection';
import QuickActions from './dashboard/QuickActions';
import PartnershipNotifications from './dashboard/PartnershipNotifications';

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

  const { data: partnerships } = useQuery({
    queryKey: ['partnerships', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('partnerships')
        .select(`
          *,
          dominant_profile:profiles!partnerships_dominant_id_fkey(display_name, role),
          submissive_profile:profiles!partnerships_submissive_id_fkey(display_name, role)
        `)
        .or(`dominant_id.eq.${user.id},submissive_id.eq.${user.id}`)
        .eq('status', 'accepted');

      if (error) throw error;
      return data;
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

        {/* Partnership Notifications */}
        <PartnershipNotifications />

        {/* Stats Cards */}
        <StatsCards 
          pointsBalance={pointsBalance || 0}
          completedHabits={completedHabits}
          totalHabits={totalHabits}
        />

        {/* Today's Habits */}
        <HabitsSection 
          habits={todayHabits || []}
          userRole={profile?.role || 'submissive'}
          userId={user?.id || ''}
        />

        {/* Partnership Status */}
        {partnerships && partnerships.length > 0 && (
          <div className="grid gap-4 md:gap-6">
            <h2 className="text-xl font-semibold">Vos partenaires</h2>
            <div className="grid gap-4">
              {partnerships.map((partnership) => {
                const isCurrentUserDominant = partnership.dominant_id === user?.id;
                const partnerName = isCurrentUserDominant 
                  ? partnership.submissive_profile?.display_name 
                  : partnership.dominant_profile?.display_name;
                const partnerRole = isCurrentUserDominant ? 'submissive' : 'dominant';
                
                return (
                  <div key={partnership.id} className="p-4 rounded-lg border bg-accent/5 border-accent/20">
                    <div className="flex items-center space-x-3">
                      {partnerRole === 'dominant' ? (
                        <Crown className="w-5 h-5 text-primary" />
                      ) : (
                        <User className="w-5 h-5 text-accent" />
                      )}
                      <div>
                        <h3 className="font-medium">{partnerName}</h3>
                        <p className="text-sm text-muted-foreground">
                          {partnerRole === 'dominant' ? 'Votre Dominant(e)' : 'Votre Soumis(e)'}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <QuickActions userRole={profile?.role || 'submissive'} />
      </div>
    </div>
  );
};

export default Dashboard;