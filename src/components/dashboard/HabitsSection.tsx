import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Target, Gift, Check } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Habit {
  id: string;
  title: string;
  description?: string;
  points_value: number;
  completed: boolean;
}

interface HabitsSectionProps {
  habits: Habit[];
  userRole: string;
  userId: string;
}

const HabitsSection = ({ habits, userRole, userId }: HabitsSectionProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const completeHabitMutation = useMutation({
    mutationFn: async (habitId: string) => {
      const habit = habits.find(h => h.id === habitId);
      if (!habit) throw new Error('Habit not found');

      // Complete the habit
      const { error: completionError } = await supabase
        .from('habit_completions')
        .insert({
          habit_id: habitId,
          user_id: userId,
          points_earned: habit.points_value
        });

      if (completionError) throw completionError;

      // Award points
      const { error: pointsError } = await supabase
        .from('points_transactions')
        .insert({
          user_id: userId,
          created_by: userId,
          type: 'bonus',
          points: habit.points_value,
          reason: `Habitude accomplie: ${habit.title}`,
          reference_id: habitId
        });

      if (pointsError) throw pointsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todayHabits'] });
      queryClient.invalidateQueries({ queryKey: ['points'] });
      toast({
        title: "Habitude accomplie !",
        description: "Vous avez gagné des points de dévotion.",
      });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de compléter l'habitude.",
        variant: "destructive",
      });
    }
  });

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Target className="w-5 h-5 text-primary" />
          <span>Vos habitudes du jour</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!habits || habits.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <Gift className="w-12 h-12 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">Aucune habitude assignée pour aujourd'hui</p>
            <p className="text-sm text-muted-foreground">
              {userRole === 'dominant' 
                ? "Créez des habitudes pour vos soumis(es)" 
                : "Demandez à votre Dominant(e) de vous assigner des tâches"
              }
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {habits.map((habit) => (
              <div
                key={habit.id}
                className={`p-4 rounded-lg border transition-colors ${
                  habit.completed
                    ? 'bg-accent/10 border-accent/30'
                    : 'bg-card border-border hover:bg-accent/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="space-y-1 flex-1">
                    <h3 className="font-medium">{habit.title}</h3>
                    {habit.description && (
                      <p className="text-sm text-muted-foreground">{habit.description}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={habit.completed ? "default" : "outline"}>
                      {habit.points_value} pts
                    </Badge>
                    {habit.completed ? (
                      <Badge className="bg-accent text-accent-foreground">
                        <Check className="w-3 h-3 mr-1" />
                        Accompli
                      </Badge>
                    ) : (
                      <Button 
                        size="sm"
                        onClick={() => completeHabitMutation.mutate(habit.id)}
                        disabled={completeHabitMutation.isPending}
                      >
                        Compléter
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default HabitsSection;