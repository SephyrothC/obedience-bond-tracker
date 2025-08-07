import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Calendar as CalendarIcon, CheckCircle, XCircle, Target, Clock, User } from 'lucide-react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const Calendar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [currentView, setCurrentView] = useState<'week' | 'month'>('week');

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

  // Get habits and completions for the selected period
  const { data: habitsData } = useQuery({
    queryKey: ['calendarHabits', partnerships?.[0]?.submissive_id, selectedDate, currentView],
    queryFn: async () => {
      const partnership = partnerships?.[0];
      if (!partnership) return null;

      const submissiveId = partnership.submissive_id;

      // Calculate date range based on view
      const startDate = currentView === 'week' 
        ? startOfWeek(selectedDate, { weekStartsOn: 1 })
        : startOfMonth(selectedDate);
      const endDate = currentView === 'week' 
        ? endOfWeek(selectedDate, { weekStartsOn: 1 })
        : endOfMonth(selectedDate);

      // Get habits assigned to submissive
      const { data: habits, error: habitsError } = await supabase
        .from('habits')
        .select('*')
        .eq('assigned_to', submissiveId)
        .eq('is_active', true);

      if (habitsError) throw habitsError;

      // Get completions for the period
      const { data: completions, error: completionsError } = await supabase
        .from('habit_completions')
        .select('*')
        .eq('user_id', submissiveId)
        .gte('completed_at', startDate.toISOString())
        .lte('completed_at', endDate.toISOString())
        .order('completed_at', { ascending: true });

      if (completionsError) throw completionsError;

      return {
        habits: habits || [],
        completions: completions || [],
        startDate,
        endDate
      };
    },
    enabled: !!partnerships?.[0] && profile?.role === 'dominant'
  });

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
              Agenda des habitudes
            </h1>
          </div>
          
          <Card className="shadow-soft">
            <CardContent className="py-8 text-center">
              <CalendarIcon className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Vous devez avoir un partenariat actif pour voir l'agenda
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const partnership = partnerships[0];
  const submissiveProfile = partnership.submissive_profile;

  const getHabitsForDate = (date: Date) => {
    if (!habitsData) return [];

    const dateString = format(date, 'yyyy-MM-dd');
    const dayCompletions = habitsData.completions.filter(completion => 
      format(parseISO(completion.completed_at), 'yyyy-MM-dd') === dateString
    );

    return habitsData.habits.map(habit => {
      const completion = dayCompletions.find(c => c.habit_id === habit.id);
      return {
        ...habit,
        completed: !!completion,
        completion: completion
      };
    });
  };

  const getDaysToShow = () => {
    if (!habitsData) return [];
    
    return eachDayOfInterval({
      start: habitsData.startDate,
      end: habitsData.endDate
    });
  };

  const getCompletionRate = (date: Date) => {
    const habits = getHabitsForDate(date);
    if (habits.length === 0) return 0;
    const completed = habits.filter(h => h.completed).length;
    return Math.round((completed / habits.length) * 100);
  };

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" onClick={() => navigate('/')}>
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold gradient-passion bg-clip-text text-transparent">
                Agenda de {submissiveProfile?.display_name}
              </h1>
              <div className="flex items-center space-x-2 mt-1">
                <Badge variant="outline" className="text-accent border-accent/50">
                  <User className="w-3 h-3 mr-1" />
                  Soumis(e)
                </Badge>
              </div>
            </div>
          </div>

          <Tabs value={currentView} onValueChange={(value) => setCurrentView(value as 'week' | 'month')}>
            <TabsList>
              <TabsTrigger value="week">Semaine</TabsTrigger>
              <TabsTrigger value="month">Mois</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="grid lg:grid-cols-3 gap-6">
          {/* Calendar Selector */}
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <CalendarIcon className="w-5 h-5 text-primary" />
                <span>Navigation</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <CalendarComponent
                mode="single"
                selected={selectedDate}
                onSelect={(date) => date && setSelectedDate(date)}
                className="rounded-md border pointer-events-auto"
                locale={fr}
              />
              <div className="mt-4 space-y-2">
                <div className="text-sm font-medium">
                  {currentView === 'week' ? 'Semaine du' : 'Mois de'}{' '}
                  {format(selectedDate, currentView === 'week' ? 'dd MMMM yyyy' : 'MMMM yyyy', { locale: fr })}
                </div>
                {habitsData && (
                  <div className="text-xs text-muted-foreground">
                    {habitsData.habits.length} habitude(s) assignée(s)
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Timeline View */}
          <div className="lg:col-span-2 space-y-4">
            {getDaysToShow().map((date, index) => {
              const dayHabits = getHabitsForDate(date);
              const completionRate = getCompletionRate(date);
              const isToday = isSameDay(date, new Date());
              const isSelected = isSameDay(date, selectedDate);

              return (
                <Card 
                  key={index} 
                  className={cn(
                    "shadow-soft transition-all cursor-pointer",
                    isSelected && "ring-2 ring-primary",
                    isToday && "bg-accent/5 border-accent/30"
                  )}
                  onClick={() => setSelectedDate(date)}
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={cn(
                          "w-12 h-12 rounded-lg flex flex-col items-center justify-center text-xs font-medium",
                          isToday ? "bg-primary text-primary-foreground" : "bg-accent/10"
                        )}>
                          <div>{format(date, 'dd', { locale: fr })}</div>
                          <div className="text-[10px] opacity-75">
                            {format(date, 'EEE', { locale: fr })}
                          </div>
                        </div>
                        <div>
                          <h3 className="font-medium">
                            {format(date, 'EEEE dd MMMM', { locale: fr })}
                          </h3>
                          <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                            <Target className="w-3 h-3" />
                            <span>{dayHabits.length} habitude(s)</span>
                            {dayHabits.length > 0 && (
                              <>
                                <span>•</span>
                                <span className={cn(
                                  "font-medium",
                                  completionRate === 100 ? "text-accent" : 
                                  completionRate >= 50 ? "text-amber-600" : "text-destructive"
                                )}>
                                  {completionRate}% réalisé
                                </span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                      {isToday && (
                        <Badge variant="outline" className="text-primary border-primary/50">
                          Aujourd'hui
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    {dayHabits.length === 0 ? (
                      <div className="text-center py-4 text-muted-foreground text-sm">
                        Aucune habitude assignée ce jour
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {dayHabits.map((habit) => (
                          <div 
                            key={habit.id} 
                            className={cn(
                              "flex items-center justify-between p-3 rounded-lg border transition-colors",
                              habit.completed ? "bg-accent/10 border-accent/30" : "bg-muted/30"
                            )}
                          >
                            <div className="flex items-center space-x-3">
                              {habit.completed ? (
                                <CheckCircle className="w-5 h-5 text-accent" />
                              ) : (
                                <XCircle className="w-5 h-5 text-muted-foreground" />
                              )}
                              <div>
                                <h4 className="font-medium text-sm">{habit.title}</h4>
                                {habit.description && (
                                  <p className="text-xs text-muted-foreground">{habit.description}</p>
                                )}
                                {habit.completion && (
                                  <div className="flex items-center space-x-1 text-xs text-muted-foreground mt-1">
                                    <Clock className="w-3 h-3" />
                                    <span>
                                      Réalisé à {format(parseISO(habit.completion.completed_at), 'HH:mm', { locale: fr })}
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Badge 
                                variant={habit.completed ? "default" : "outline"}
                                className={habit.completed ? "bg-accent text-accent-foreground" : ""}
                              >
                                {habit.points_value} pts
                              </Badge>
                              <Badge variant={habit.completed ? "default" : "secondary"}>
                                {habit.completed ? "Fait" : "En attente"}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Summary Stats */}
        {habitsData && (
          <Card className="shadow-soft">
            <CardHeader>
              <CardTitle>Résumé de la période</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-accent">
                    {habitsData.completions.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Tâches réalisées</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {habitsData.habits.length}
                  </div>
                  <div className="text-sm text-muted-foreground">Habitudes actives</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-accent">
                    {habitsData.completions.reduce((total, completion) => total + completion.points_earned, 0)}
                  </div>
                  <div className="text-sm text-muted-foreground">Points gagnés</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {getDaysToShow().length}
                  </div>
                  <div className="text-sm text-muted-foreground">Jours affichés</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Calendar;