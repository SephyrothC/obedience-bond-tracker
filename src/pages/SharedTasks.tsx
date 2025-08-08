import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Users, Plus, Calendar, CheckCircle, Target, ArrowLeft } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

interface SharedTask {
  id: string;
  title: string;
  description?: string;
  points_value: number;
  completion_target: number;
  current_progress: number;
  due_date?: string;
  created_by: string;
  created_at: string;
  is_active: boolean;
}

interface TaskContribution {
  id: string;
  contribution_amount: number;
  notes?: string;
  created_at: string;
  user_id: string;
  profiles: {
    display_name: string;
  };
}

const SharedTasks = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<SharedTask | null>(null);
  const [contributionAmount, setContributionAmount] = useState(1);
  const [contributionNotes, setContributionNotes] = useState('');

  // Form state for new task
  const [newTask, setNewTask] = useState({
    title: '',
    description: '',
    points_value: 1,
    completion_target: 1,
    due_date: ''
  });

  // Get user's partnership
  const { data: partnership } = useQuery({
    queryKey: ['partnership', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partnerships')
        .select('*')
        .or(`dominant_id.eq.${user?.id},submissive_id.eq.${user?.id}`)
        .eq('status', 'accepted')
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  // Get shared tasks
  const { data: sharedTasks, isLoading } = useQuery({
    queryKey: ['sharedTasks', partnership?.id],
    queryFn: async () => {
      if (!partnership?.id) return [];
      
      const { data, error } = await supabase
        .from('shared_tasks')
        .select('*')
        .eq('partnership_id', partnership.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as SharedTask[];
    },
    enabled: !!partnership?.id
  });

  // Get contributions for a specific task
  const { data: taskContributions } = useQuery({
    queryKey: ['taskContributions', selectedTask?.id],
    queryFn: async () => {
      if (!selectedTask?.id) return [];
      
      const { data, error } = await supabase
        .from('shared_task_contributions')
        .select(`
          id,
          contribution_amount,
          notes,
          created_at,
          user_id
        `)
        .eq('shared_task_id', selectedTask.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;

      // Get profile data separately
      const userIds = data?.map(d => d.user_id) || [];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', userIds);

      // Merge the data
      const contributionsWithProfiles = data?.map(contribution => ({
        ...contribution,
        profiles: profiles?.find(p => p.user_id === contribution.user_id) || { display_name: 'Utilisateur inconnu' }
      })) || [];

      return contributionsWithProfiles as TaskContribution[];
    },
    enabled: !!selectedTask?.id
  });

  // Create task mutation
  const createTaskMutation = useMutation({
    mutationFn: async (taskData: typeof newTask) => {
      if (!partnership?.id) throw new Error('No partnership found');
      
      const { error } = await supabase
        .from('shared_tasks')
        .insert({
          ...taskData,
          partnership_id: partnership.id,
          created_by: user?.id,
          due_date: taskData.due_date || null
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sharedTasks'] });
      setIsCreateDialogOpen(false);
      setNewTask({ title: '', description: '', points_value: 1, completion_target: 1, due_date: '' });
      toast({
        title: "Tâche créée !",
        description: "La tâche partagée a été créée avec succès.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de créer la tâche.",
        variant: "destructive",
      });
    }
  });

  // Add contribution mutation
  const addContributionMutation = useMutation({
    mutationFn: async ({ taskId, amount, notes }: { taskId: string; amount: number; notes: string }) => {
      const { error: contributionError } = await supabase
        .from('shared_task_contributions')
        .insert({
          shared_task_id: taskId,
          user_id: user?.id,
          contribution_amount: amount,
          notes: notes || null
        });
      
      if (contributionError) throw contributionError;

      // Update task progress
      const task = sharedTasks?.find(t => t.id === taskId);
      if (task) {
        const newProgress = Math.min(task.current_progress + amount, task.completion_target);
        const { error: updateError } = await supabase
          .from('shared_tasks')
          .update({ current_progress: newProgress })
          .eq('id', taskId);
        
        if (updateError) throw updateError;

        // If task is completed, award points to both partners
        if (newProgress >= task.completion_target) {
          const partnerId = partnership?.dominant_id === user?.id 
            ? partnership.submissive_id 
            : partnership.dominant_id;

          // Award points to current user
          await supabase
            .from('points_transactions')
            .insert({
              user_id: user?.id,
              created_by: user?.id,
              type: 'bonus',
              points: task.points_value,
              reason: `Tâche partagée accomplie: ${task.title}`,
              reference_id: taskId
            });

          // Award points to partner
          if (partnerId) {
            await supabase
              .from('points_transactions')
              .insert({
                user_id: partnerId,
                created_by: user?.id,
                type: 'bonus',
                points: task.points_value,
                reason: `Tâche partagée accomplie: ${task.title}`,
                reference_id: taskId
              });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sharedTasks'] });
      queryClient.invalidateQueries({ queryKey: ['taskContributions'] });
      setContributionAmount(1);
      setContributionNotes('');
      toast({
        title: "Contribution ajoutée !",
        description: "Votre contribution a été enregistrée.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter la contribution.",
        variant: "destructive",
      });
    }
  });

  const handleCreateTask = () => {
    if (!newTask.title.trim()) return;
    createTaskMutation.mutate(newTask);
  };

  const handleAddContribution = (taskId: string) => {
    if (contributionAmount <= 0) return;
    addContributionMutation.mutate({
      taskId,
      amount: contributionAmount,
      notes: contributionNotes
    });
  };

  const isCompleted = (task: SharedTask) => task.current_progress >= task.completion_target;
  const progressPercentage = (task: SharedTask) => (task.current_progress / task.completion_target) * 100;

  if (isLoading) {
    return <div className="container mx-auto py-8">Chargement...</div>;
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Tâches Partagées</h1>
            <p className="text-muted-foreground">Travaillez ensemble sur des objectifs communs</p>
          </div>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nouvelle tâche
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer une tâche partagée</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Titre</Label>
                <Input
                  id="title"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  placeholder="Titre de la tâche"
                />
              </div>
              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Description optionnelle"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="points">Points (par personne)</Label>
                  <Input
                    id="points"
                    type="number"
                    min="1"
                    value={newTask.points_value}
                    onChange={(e) => setNewTask({ ...newTask, points_value: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div>
                  <Label htmlFor="target">Objectif total</Label>
                  <Input
                    id="target"
                    type="number"
                    min="1"
                    value={newTask.completion_target}
                    onChange={(e) => setNewTask({ ...newTask, completion_target: parseInt(e.target.value) || 1 })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="due_date">Date limite (optionnelle)</Label>
                <Input
                  id="due_date"
                  type="date"
                  value={newTask.due_date}
                  onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                />
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleCreateTask}
                  disabled={createTaskMutation.isPending || !newTask.title.trim()}
                  className="flex-1"
                >
                  {createTaskMutation.isPending ? "Création..." : "Créer"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {!sharedTasks || sharedTasks.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Users className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune tâche partagée</h3>
            <p className="text-muted-foreground mb-4">
              Créez votre première tâche partagée pour travailler ensemble
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Créer une tâche
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {sharedTasks.map((task) => (
            <Card key={task.id} className={`${isCompleted(task) ? 'bg-accent/10 border-accent/30' : ''}`}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center space-x-2">
                      {isCompleted(task) ? (
                        <CheckCircle className="w-5 h-5 text-accent" />
                      ) : (
                        <Target className="w-5 h-5 text-primary" />
                      )}
                      <span>{task.title}</span>
                    </CardTitle>
                    {task.description && (
                      <p className="text-muted-foreground">{task.description}</p>
                    )}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge variant={isCompleted(task) ? "default" : "outline"}>
                      {task.points_value} pts chacun
                    </Badge>
                    {task.due_date && (
                      <Badge variant="outline">
                        <Calendar className="w-3 h-3 mr-1" />
                        {new Date(task.due_date).toLocaleDateString()}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>Progression</span>
                      <span>{task.current_progress} / {task.completion_target}</span>
                    </div>
                    <div className="w-full bg-secondary h-2 rounded-full">
                      <div 
                        className="bg-primary h-2 rounded-full transition-all duration-300"
                        style={{ width: `${Math.min(progressPercentage(task), 100)}%` }}
                      />
                    </div>
                  </div>

                  {!isCompleted(task) && (
                    <div className="flex space-x-2">
                      <Input
                        type="number"
                        min="1"
                        max={task.completion_target - task.current_progress}
                        value={contributionAmount}
                        onChange={(e) => setContributionAmount(parseInt(e.target.value) || 1)}
                        placeholder="Quantité"
                        className="w-24"
                      />
                      <Input
                        value={contributionNotes}
                        onChange={(e) => setContributionNotes(e.target.value)}
                        placeholder="Note (optionnelle)"
                        className="flex-1"
                      />
                      <Button
                        onClick={() => handleAddContribution(task.id)}
                        disabled={addContributionMutation.isPending}
                      >
                        Contribuer
                      </Button>
                    </div>
                  )}

                  <Button
                    variant="outline"
                    onClick={() => setSelectedTask(selectedTask?.id === task.id ? null : task)}
                    className="w-full"
                  >
                    {selectedTask?.id === task.id ? 'Masquer' : 'Voir'} les contributions
                  </Button>

                  {selectedTask?.id === task.id && taskContributions && (
                    <div className="mt-4 space-y-2">
                      <h4 className="font-medium">Contributions récentes</h4>
                      {taskContributions.map((contribution) => (
                        <div key={contribution.id} className="p-3 border rounded-lg bg-card">
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="font-medium">{contribution.profiles.display_name}</p>
                              {contribution.notes && (
                                <p className="text-sm text-muted-foreground">{contribution.notes}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <Badge variant="outline">+{contribution.contribution_amount}</Badge>
                              <p className="text-xs text-muted-foreground mt-1">
                                {new Date(contribution.created_at).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default SharedTasks;