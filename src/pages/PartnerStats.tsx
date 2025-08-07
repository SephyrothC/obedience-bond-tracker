import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ArrowLeft, Crown, User, Zap, Target, Calendar, CheckCircle, XCircle, Plus, Minus } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

const pointsSchema = z.object({
  points: z.number().min(-999).max(999),
  reason: z.string().min(1, 'La raison est obligatoire')
});

type PointsFormData = z.infer<typeof pointsSchema>;

const PartnerStats = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const form = useForm<PointsFormData>({
    resolver: zodResolver(pointsSchema),
    defaultValues: {
      points: 0,
      reason: ''
    }
  });

  // Get user's profile to verify they are dominant
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

  // Get active partnerships where user is dominant
  const { data: partnerships } = useQuery({
    queryKey: ['dominantPartnerships', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('partnerships')
        .select(`
          *,
          submissive_profile:profiles!partnerships_submissive_id_fkey(*)
        `)
        .eq('dominant_id', user.id)
        .eq('status', 'accepted');

      if (error) throw error;
      return data;
    },
    enabled: !!user && profile?.role === 'dominant'
  });

  // Get submissive partner stats
  const { data: partnerStats } = useQuery({
    queryKey: ['partnerStats', partnerships?.[0]?.submissive_id],
    queryFn: async () => {
      const partnership = partnerships?.[0];
      if (!partnership) return null;

      const submissiveId = partnership.submissive_id;

      // Get points balance
      const { data: pointsData, error: pointsError } = await supabase
        .from('points_transactions')
        .select('points')
        .eq('user_id', submissiveId);

      if (pointsError) throw pointsError;

      const pointsBalance = pointsData.reduce((total, transaction) => total + transaction.points, 0);

      // Get habits assigned to submissive
      const { data: habitsData, error: habitsError } = await supabase
        .from('habits')
        .select('*')
        .eq('assigned_to', submissiveId)
        .eq('is_active', true);

      if (habitsError) throw habitsError;

      // Get today's completions
      const today = new Date().toISOString().split('T')[0];
      const { data: todayCompletions, error: todayError } = await supabase
        .from('habit_completions')
        .select('*')
        .eq('user_id', submissiveId)
        .gte('completed_at', `${today}T00:00:00`);

      if (todayError) throw todayError;

      // Get last 7 days completions
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { data: weekCompletions, error: weekError } = await supabase
        .from('habit_completions')
        .select('*')
        .eq('user_id', submissiveId)
        .gte('completed_at', sevenDaysAgo.toISOString())
        .order('completed_at', { ascending: false });

      if (weekError) throw weekError;

      // Get recent points transactions
      const { data: recentTransactions, error: transactionsError } = await supabase
        .from('points_transactions')
        .select('*')
        .eq('user_id', submissiveId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (transactionsError) throw transactionsError;

      return {
        pointsBalance,
        habits: habitsData,
        todayCompletions,
        weekCompletions,
        recentTransactions
      };
    },
    enabled: !!partnerships?.[0] && profile?.role === 'dominant'
  });

  // Manual points adjustment mutation
  const adjustPointsMutation = useMutation({
    mutationFn: async ({ points, reason }: PointsFormData) => {
      const partnership = partnerships?.[0];
      if (!partnership) throw new Error('Aucun partenariat trouvé');

      const { error } = await supabase
        .from('points_transactions')
        .insert({
          user_id: partnership.submissive_id,
          created_by: user!.id,
          points,
          reason,
          type: points >= 0 ? 'bonus' : 'penalty'
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Points modifiés !",
        description: "Les points ont été ajustés avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: ['partnerStats'] });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de modifier les points. Veuillez réessayer.",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: PointsFormData) => {
    adjustPointsMutation.mutate(data);
  };

  // Redirect if not dominant
  if (profile && profile.role !== 'dominant') {
    navigate('/');
    return null;
  }

  // Show message if no partnerships
  if (!partnerships || partnerships.length === 0) {
    return (
      <div className="min-h-screen p-4 md:p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-3xl font-bold gradient-passion bg-clip-text text-transparent">
              Statistiques du partenaire
            </h1>
          </div>
          
          <Card className="shadow-soft">
            <CardContent className="py-8 text-center">
              <Crown className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Vous devez avoir un partenariat actif pour voir les statistiques
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const partnership = partnerships[0];
  const submissiveProfile = partnership.submissive_profile;

  const todayCompletedHabits = partnerStats?.todayCompletions?.length || 0;
  const totalHabits = partnerStats?.habits?.length || 0;
  const todayCompletionRate = totalHabits > 0 ? Math.round((todayCompletedHabits / totalHabits) * 100) : 0;

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold gradient-passion bg-clip-text text-transparent">
              Statistiques de {submissiveProfile?.display_name}
            </h1>
            <div className="flex items-center space-x-2 mt-1">
              <Badge variant="outline" className="text-accent border-accent/50">
                <User className="w-3 h-3 mr-1" />
                Soumis(e)
              </Badge>
            </div>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Points totaux</CardTitle>
              <Zap className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-accent">{partnerStats?.pointsBalance || 0}</div>
              <p className="text-xs text-muted-foreground">
                Récompenses accumulées
              </p>
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="mt-2 w-full">
                    <Zap className="w-3 h-3 mr-1" />
                    Modifier
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Ajuster les points</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="points"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Points à ajouter/retirer</FormLabel>
                            <div className="flex space-x-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => field.onChange(Math.max(-999, field.value - 1))}
                              >
                                <Minus className="w-4 h-4" />
                              </Button>
                              <FormControl>
                                <Input
                                  type="number"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  className="text-center"
                                />
                              </FormControl>
                              <Button
                                type="button"
                                variant="outline"
                                size="icon"
                                onClick={() => field.onChange(Math.min(999, field.value + 1))}
                              >
                                <Plus className="w-4 h-4" />
                              </Button>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="reason"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Raison</FormLabel>
                            <FormControl>
                              <Textarea
                                placeholder="Pourquoi ajustez-vous les points ?"
                                {...field}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex space-x-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setIsDialogOpen(false)}
                          className="flex-1"
                        >
                          Annuler
                        </Button>
                        <Button
                          type="submit"
                          disabled={adjustPointsMutation.isPending}
                          className="flex-1"
                        >
                          {adjustPointsMutation.isPending ? 'Modification...' : 'Confirmer'}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aujourd'hui</CardTitle>
              <Target className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {todayCompletedHabits}/{totalHabits}
              </div>
              <p className="text-xs text-muted-foreground">
                {todayCompletionRate}% de réussite
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-soft">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cette semaine</CardTitle>
              <Calendar className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{partnerStats?.weekCompletions?.length || 0}</div>
              <p className="text-xs text-muted-foreground">
                Tâches accomplies
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Habits Overview */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="w-5 h-5 text-primary" />
              <span>Habitudes assignées</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!partnerStats?.habits || partnerStats.habits.length === 0 ? (
              <div className="text-center py-8 space-y-2">
                <Target className="w-12 h-12 text-muted-foreground mx-auto" />
                <p className="text-muted-foreground">Aucune habitude assignée</p>
              </div>
            ) : (
              <div className="space-y-3">
                {partnerStats.habits.map((habit) => {
                  const isCompletedToday = partnerStats.todayCompletions?.some(
                    completion => completion.habit_id === habit.id
                  );
                  
                  return (
                    <div key={habit.id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        {isCompletedToday ? (
                          <CheckCircle className="w-5 h-5 text-accent" />
                        ) : (
                          <XCircle className="w-5 h-5 text-muted-foreground" />
                        )}
                        <div>
                          <h3 className="font-medium">{habit.title}</h3>
                          {habit.description && (
                            <p className="text-sm text-muted-foreground">{habit.description}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={isCompletedToday ? "default" : "outline"}>
                          {habit.points_value} pts
                        </Badge>
                        <Badge variant={isCompletedToday ? "default" : "secondary"}>
                          {isCompletedToday ? "Fait" : "En attente"}
                        </Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Recent Completions */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CheckCircle className="w-5 h-5 text-accent" />
                <span>Activité récente</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!partnerStats?.weekCompletions || partnerStats.weekCompletions.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">Aucune activité récente</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {partnerStats.weekCompletions.slice(0, 5).map((completion) => {
                    const habit = partnerStats.habits?.find(h => h.id === completion.habit_id);
                    return (
                      <div key={completion.id} className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{habit?.title || 'Habitude supprimée'}</p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(completion.completed_at), 'PPP à HH:mm', { locale: fr })}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-accent border-accent/50">
                          +{completion.points_earned} pts
                        </Badge>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Points */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="w-5 h-5 text-accent" />
                <span>Transactions récentes</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!partnerStats?.recentTransactions || partnerStats.recentTransactions.length === 0 ? (
                <div className="text-center py-4">
                  <p className="text-muted-foreground">Aucune transaction</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {partnerStats.recentTransactions.slice(0, 5).map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">
                          {transaction.reason || 'Transaction'}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(transaction.created_at), 'PPP à HH:mm', { locale: fr })}
                        </p>
                      </div>
                      <Badge 
                        variant={transaction.points >= 0 ? "default" : "destructive"}
                        className={transaction.points >= 0 ? "bg-accent text-accent-foreground" : ""}
                      >
                        {transaction.points >= 0 ? '+' : ''}{transaction.points} pts
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PartnerStats;