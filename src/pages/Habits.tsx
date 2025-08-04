import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Target, Plus, ArrowLeft, Clock, CheckCircle2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Habits = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  const { data: habits } = useQuery({
    queryKey: ['habits', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const query = profile?.role === 'dominant' 
        ? supabase.from('habits').select('*').eq('created_by', user.id)
        : supabase.from('habits').select('*').eq('assigned_to', user.id);
      
      const { data, error } = await query.eq('is_active', true).order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user && !!profile
  });

  const { data: completionsToday } = useQuery({
    queryKey: ['completionsToday', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('habit_completions')
        .select('habit_id')
        .eq('user_id', user.id)
        .gte('completed_at', `${today}T00:00:00`);

      if (error) throw error;
      return data.map(c => c.habit_id);
    },
    enabled: !!user
  });

  const getFrequencyLabel = (frequency: string) => {
    const labels = {
      daily: 'Quotidien',
      weekly: 'Hebdomadaire',
      monthly: 'Mensuel'
    };
    return labels[frequency as keyof typeof labels] || frequency;
  };

  const isCompletedToday = (habitId: string) => {
    return completionsToday?.includes(habitId) || false;
  };

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold gradient-passion bg-clip-text text-transparent">
                Habitudes
              </h1>
              <p className="text-muted-foreground">
                {profile?.role === 'dominant' 
                  ? "Gérez les habitudes de vos soumis(es)"
                  : "Vos tâches et habitudes assignées"
                }
              </p>
            </div>
          </div>
          
          {profile?.role === 'dominant' && (
            <Button onClick={() => navigate('/habits/create')}>
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle habitude
            </Button>
          )}
        </div>

        {/* Habits List */}
        <div className="space-y-4">
          {!habits || habits.length === 0 ? (
            <Card className="shadow-soft">
              <CardContent className="text-center py-12">
                <Target className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Aucune habitude</h3>
                <p className="text-muted-foreground mb-4">
                  {profile?.role === 'dominant' 
                    ? "Créez votre première habitude pour vos soumis(es)"
                    : "Aucune habitude ne vous a été assignée"
                  }
                </p>
                {profile?.role === 'dominant' && (
                  <Button onClick={() => navigate('/habits/create')}>
                    <Plus className="w-4 h-4 mr-2" />
                    Créer une habitude
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            habits.map((habit) => (
              <Card key={habit.id} className="shadow-soft hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <CardTitle className="flex items-center space-x-2">
                        <span>{habit.title}</span>
                        {isCompletedToday(habit.id) && (
                          <CheckCircle2 className="w-5 h-5 text-accent" />
                        )}
                      </CardTitle>
                      {habit.description && (
                        <p className="text-sm text-muted-foreground">{habit.description}</p>
                      )}
                    </div>
                    <div className="flex flex-col items-end space-y-2">
                      <Badge variant="outline" className="flex items-center space-x-1">
                        <Clock className="w-3 h-3" />
                        <span>{getFrequencyLabel(habit.frequency)}</span>
                      </Badge>
                      <Badge className="bg-primary">
                        {habit.points_value} pts
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      Créé le {new Date(habit.created_at).toLocaleDateString('fr-FR')}
                    </div>
                    {isCompletedToday(habit.id) ? (
                      <Badge variant="secondary" className="bg-accent/20 text-accent">
                        Accompli aujourd'hui
                      </Badge>
                    ) : (
                      <Badge variant="outline">
                        En attente
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Habits;