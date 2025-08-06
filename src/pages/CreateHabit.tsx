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
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { ArrowLeft, Plus, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const habitSchema = z.object({
  title: z.string().min(1, 'Le titre est requis').max(100, 'Le titre ne peut pas dépasser 100 caractères'),
  description: z.string().max(500, 'La description ne peut pas dépasser 500 caractères').optional(),
  frequency: z.enum(['daily', 'weekly', 'custom']),
  points_value: z.number().min(1, 'La valeur doit être au moins 1').max(100, 'La valeur ne peut pas dépasser 100'),
  assigned_to: z.string().min(1, 'Vous devez assigner cette habitude à quelqu\'un')
});

type HabitFormData = z.infer<typeof habitSchema>;

const CreateHabit = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<HabitFormData>({
    resolver: zodResolver(habitSchema),
    defaultValues: {
      title: '',
      description: '',
      frequency: 'daily',
      points_value: 5,
      assigned_to: ''
    }
  });

  // Get user's profile to verify they're dominant
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

  // Get available submissives from partnerships
  const { data: submissives } = useQuery({
    queryKey: ['submissives', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data: partnerships, error: partnershipError } = await supabase
        .from('partnerships')
        .select('submissive_id')
        .eq('dominant_id', user.id)
        .eq('status', 'accepted');

      if (partnershipError) throw partnershipError;

      if (partnerships.length === 0) return [];

      const submissiveIds = partnerships.map(p => p.submissive_id);
      
      const { data: profiles, error: profilesError } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', submissiveIds);

      if (profilesError) throw profilesError;
      return profiles;
    },
    enabled: !!user && profile?.role === 'dominant'
  });

  const createHabitMutation = useMutation({
    mutationFn: async (data: HabitFormData) => {
      if (!user) throw new Error('User not authenticated');

      const { error } = await supabase
        .from('habits')
        .insert({
          title: data.title,
          description: data.description || null,
          frequency: data.frequency,
          points_value: data.points_value,
          created_by: user.id,
          assigned_to: data.assigned_to
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Habitude créée !",
        description: "La nouvelle habitude a été assignée avec succès.",
      });
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      navigate('/habits');
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de créer l'habitude. Veuillez réessayer.",
        variant: "destructive",
      });
    }
  });

  const onSubmit = (data: HabitFormData) => {
    createHabitMutation.mutate(data);
  };

  // Redirect if not dominant
  if (profile && profile.role !== 'dominant') {
    navigate('/habits');
    return null;
  }

  const frequencyOptions = [
    { value: 'daily', label: 'Quotidienne' },
    { value: 'weekly', label: 'Hebdomadaire' },
    { value: 'custom', label: 'Personnalisée' }
  ];

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate('/habits')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold gradient-passion bg-clip-text text-transparent">
              Créer une habitude
            </h1>
            <p className="text-muted-foreground">
              Créez une nouvelle habitude pour vous ou vos partenaires
            </p>
          </div>
        </div>

        {/* Form */}
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Target className="w-5 h-5 text-primary" />
              <span>Détails de l'habitude</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {submissives !== undefined ? (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Titre de l'habitude *</FormLabel>
                        <FormControl>
                          <Input 
                            placeholder="Ex: Méditation matinale, Exercice quotidien..."
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description (optionnelle)</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Décrivez en détail ce qui est attendu..."
                            rows={3}
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="frequency"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Fréquence *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Choisir la fréquence" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {frequencyOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                  {option.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="points_value"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Points de récompense *</FormLabel>
                          <FormControl>
                            <Input 
                              type="number"
                              min="1"
                              max="100"
                              {...field}
                              onChange={e => field.onChange(parseInt(e.target.value) || 1)}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="assigned_to"
                    render={({ field }) => (
                      <FormItem>
                         <FormLabel>Assigner à *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Choisir qui doit faire cette habitude" />
                            </SelectTrigger>
                          </FormControl>
                           <SelectContent>
                            <SelectItem value={user!.id}>
                              Moi-même
                            </SelectItem>
                            {submissives.map((submissive) => (
                              <SelectItem key={submissive.user_id} value={submissive.user_id}>
                                {submissive.display_name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="flex space-x-4 pt-4">
                    <Button 
                      type="button" 
                      variant="outline" 
                      onClick={() => navigate('/habits')}
                      className="flex-1"
                    >
                      Annuler
                    </Button>
                    <Button 
                      type="submit" 
                      disabled={createHabitMutation.isPending}
                      className="flex-1"
                    >
                      {createHabitMutation.isPending ? (
                        <>
                          <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
                          Création...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Créer l'habitude
                        </>
                      )}
                    </Button>
                  </div>
                 </form>
              </Form>
            ) : (
              <div className="text-center py-8">
                <div className="w-8 h-8 border-2 border-current border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-muted-foreground">Chargement...</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default CreateHabit;