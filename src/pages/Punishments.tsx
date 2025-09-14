import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Zap, Plus, ArrowLeft, AlertTriangle, Clock, Ban, User, Crown, CheckCircle, XCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Punishment {
  id: string;
  title: string;
  description?: string;
  severity: string;
  category: string;
  created_by: string;
  for_user: string;
  is_active: boolean;
  created_at: string;
  status: string;
}

interface PunishmentAssignment {
  id: string;
  punishment_id: string;
  assigned_to: string;
  assigned_by: string;
  assigned_at: string;
  status: 'assigned' | 'completed' | 'validated';
  notes?: string;
  completed_at?: string;
  validated_by?: string;
  validated_at?: string;
  punishment?: Punishment;
}

const Punishments = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [selectedPunishment, setSelectedPunishment] = useState<Punishment | null>(null);
  const [assignmentNotes, setAssignmentNotes] = useState('');

  // Form state for new punishment
  const [newPunishment, setNewPunishment] = useState({
    title: '',
    description: '',
    severity: 'mild',
    category: 'restriction',
    for_user: ''
  });

  // Get user's profile and role
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user?.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  // Get user's partnerships
  const { data: partnerships } = useQuery({
    queryKey: ['partnerships', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partnerships')
        .select(`
          *,
          dominant_profile:profiles!partnerships_dominant_id_fkey(display_name, user_id),
          submissive_profile:profiles!partnerships_submissive_id_fkey(display_name, user_id)
        `)
        .or(`dominant_id.eq.${user?.id},submissive_id.eq.${user?.id}`)
        .eq('status', 'accepted');
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id
  });

  // Get submissive partners for dominants
  const { data: submissivePartners } = useQuery({
    queryKey: ['submissivePartners', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partnerships')
        .select(`
          submissive_id,
          submissive_profile:profiles!partnerships_submissive_id_fkey(display_name, user_id)
        `)
        .eq('dominant_id', user?.id)
        .eq('status', 'accepted');
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && profile?.role === 'dominant'
  });

  // Get available punishments (created by dominants for their partners)
  const { data: punishments, isLoading } = useQuery({
    queryKey: ['punishments', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('punishments')
        .select('*')
        .or(`for_user.eq.${user?.id},created_by.eq.${user?.id}`)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Punishment[];
    },
    enabled: !!user?.id
  });

  // Get punishment assignments
  const { data: punishmentAssignments } = useQuery({
    queryKey: ['punishmentAssignments', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('punishment_assignments')
        .select(`
          *,
          punishment:punishments(*)
        `)
        .or(`assigned_to.eq.${user?.id},assigned_by.eq.${user?.id}`)
        .order('assigned_at', { ascending: false });
      
      if (error) throw error;
      return data as PunishmentAssignment[];
    },
    enabled: !!user?.id
  });

  // Create punishment mutation
  const createPunishmentMutation = useMutation({
    mutationFn: async (punishmentData: typeof newPunishment) => {
      const { error } = await supabase
        .from('punishments')
        .insert({
          ...punishmentData,
          created_by: user?.id,
          for_user: punishmentData.for_user
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['punishments'] });
      setIsCreateDialogOpen(false);
      setNewPunishment({ title: '', description: '', severity: 'mild', category: 'restriction', for_user: '' });
      toast({
        title: "Punition créée !",
        description: "La punition a été créée avec succès.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de créer la punition.",
        variant: "destructive",
      });
    }
  });

  // Assign punishment mutation
  const assignPunishmentMutation = useMutation({
    mutationFn: async ({ punishment, notes }: { punishment: Punishment; notes: string }) => {
      const { error } = await supabase
        .from('punishment_assignments')
        .insert({
          punishment_id: punishment.id,
          assigned_to: punishment.for_user,
          assigned_by: user?.id,
          notes: notes || undefined,
          status: 'assigned'
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['punishmentAssignments'] });
      setIsAssignDialogOpen(false);
      setSelectedPunishment(null);
      setAssignmentNotes('');
      toast({
        title: "Punition assignée !",
        description: "La punition a été assignée avec succès.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'assigner la punition.",
        variant: "destructive",
      });
    }
  });

  // Complete punishment mutation (for submissives)
  const completePunishmentMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from('punishment_assignments')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', assignmentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['punishmentAssignments'] });
      toast({
        title: "Punition marquée comme terminée !",
        description: "Votre dominant pourra maintenant la valider.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de marquer la punition comme terminée.",
        variant: "destructive",
      });
    }
  });

  // Validate punishment mutation (for dominants)
  const validatePunishmentMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase
        .from('punishment_assignments')
        .update({
          status: 'validated',
          validated_by: user?.id,
          validated_at: new Date().toISOString()
        })
        .eq('id', assignmentId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['punishmentAssignments'] });
      toast({
        title: "Punition validée !",
        description: "La punition a été validée avec succès.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de valider la punition.",
        variant: "destructive",
      });
    }
  });

  const handleCreatePunishment = () => {
    if (!newPunishment.title.trim() || !newPunishment.for_user) return;
    createPunishmentMutation.mutate(newPunishment);
  };

  const handleAssignPunishment = () => {
    if (!selectedPunishment) return;
    assignPunishmentMutation.mutate({
      punishment: selectedPunishment,
      notes: assignmentNotes
    });
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'mild': return Clock;
      case 'moderate': return AlertTriangle;
      case 'severe': return Ban;
      default: return Zap;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'mild': return 'bg-yellow-500/10 text-yellow-600 border-yellow-200';
      case 'moderate': return 'bg-orange-500/10 text-orange-600 border-orange-200';
      case 'severe': return 'bg-red-500/10 text-red-600 border-red-200';
      default: return 'bg-gray-500/10 text-gray-600 border-gray-200';
    }
  };

  const getSeverityLabel = (severity: string) => {
    switch (severity) {
      case 'mild': return 'Légère';
      case 'moderate': return 'Modérée';
      case 'severe': return 'Sévère';
      default: return severity;
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case 'restriction': return 'Restriction';
      case 'task': return 'Tâche supplémentaire';
      case 'privilege': return 'Perte de privilège';
      case 'physical': return 'Physique';
      default: return category;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'assigned': return 'Assignée';
      case 'completed': return 'Terminée';
      case 'validated': return 'Validée';
      default: return status;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned': return 'bg-yellow-500/10 text-yellow-600';
      case 'completed': return 'bg-blue-500/10 text-blue-600';
      case 'validated': return 'bg-green-500/10 text-green-600';
      default: return 'bg-gray-500/10 text-gray-600';
    }
  };

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
            <h1 className="text-3xl font-bold gradient-passion bg-clip-text text-transparent">
              Punitions
            </h1>
            <p className="text-muted-foreground">
              {profile?.role === 'dominant' 
                ? "Créez et gérez les punitions pour vos soumis(es)"
                : "Consultez vos punitions assignées"
              }
            </p>
          </div>
        </div>
        {profile?.role === 'dominant' && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nouvelle punition
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Créer une punition</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="title">Titre</Label>
                  <Input
                    id="title"
                    value={newPunishment.title}
                    onChange={(e) => setNewPunishment({ ...newPunishment, title: e.target.value })}
                    placeholder="Titre de la punition"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={newPunishment.description}
                    onChange={(e) => setNewPunishment({ ...newPunishment, description: e.target.value })}
                    placeholder="Description de la punition"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="severity">Sévérité</Label>
                    <Select value={newPunishment.severity} onValueChange={(value) => setNewPunishment({ ...newPunishment, severity: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="mild">Légère</SelectItem>
                        <SelectItem value="moderate">Modérée</SelectItem>
                        <SelectItem value="severe">Sévère</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="category">Catégorie</Label>
                    <Select value={newPunishment.category} onValueChange={(value) => setNewPunishment({ ...newPunishment, category: value })}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="restriction">Restriction</SelectItem>
                        <SelectItem value="task">Tâche supplémentaire</SelectItem>
                        <SelectItem value="privilege">Perte de privilège</SelectItem>
                        <SelectItem value="physical">Physique</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label htmlFor="for_user">Pour qui</Label>
                  <Select value={newPunishment.for_user} onValueChange={(value) => setNewPunishment({ ...newPunishment, for_user: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un(e) soumis(e)" />
                    </SelectTrigger>
                    <SelectContent>
                      {submissivePartners?.map((partner) => (
                        <SelectItem key={partner.submissive_id} value={partner.submissive_id}>
                          {partner.submissive_profile?.display_name || 'Soumis(e)'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
                    onClick={handleCreatePunishment}
                    disabled={createPunishmentMutation.isPending || !newPunishment.title.trim() || !newPunishment.for_user}
                    className="flex-1"
                  >
                    {createPunishmentMutation.isPending ? "Création..." : "Créer"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Tabs defaultValue="assignments" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="assignments">
            Assignations ({punishmentAssignments?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="available">
            Disponibles ({punishments?.filter(p => p.created_by === user?.id).length || 0})
          </TabsTrigger>
          <TabsTrigger value="created">
            Créées ({punishments?.filter(p => p.created_by === user?.id).length || 0})
          </TabsTrigger>
        </TabsList>

        {/* Punishment Assignments */}
        <TabsContent value="assignments">
          {!punishmentAssignments || punishmentAssignments.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Zap className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Aucune assignation</h3>
                <p className="text-muted-foreground">
                  {profile?.role === 'dominant' 
                    ? "Assignez des punitions à vos soumis(es)"
                    : "Aucune punition ne vous a été assignée"
                  }
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {punishmentAssignments.map((assignment) => {
                const IconComponent = getSeverityIcon(assignment.punishment?.severity || 'mild');
                const isAssignedToMe = assignment.assigned_to === user?.id;
                const isAssignedByMe = assignment.assigned_by === user?.id;
                
                return (
                  <Card key={assignment.id} className="border-l-4 border-l-destructive">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center space-x-2">
                          <IconComponent className="w-5 h-5" />
                          <span>{assignment.punishment?.title}</span>
                        </span>
                        <div className="flex space-x-2">
                          <Badge variant="outline" className={getSeverityColor(assignment.punishment?.severity || 'mild')}>
                            {getSeverityLabel(assignment.punishment?.severity || 'mild')}
                          </Badge>
                          <Badge className={getStatusColor(assignment.status)}>
                            {getStatusLabel(assignment.status)}
                          </Badge>
                        </div>
                      </CardTitle>
                      {assignment.punishment?.description && (
                        <p className="text-muted-foreground text-sm">{assignment.punishment.description}</p>
                      )}
                      {assignment.notes && (
                        <p className="text-sm bg-muted p-2 rounded">
                          <strong>Notes :</strong> {assignment.notes}
                        </p>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Assignée le {format(new Date(assignment.assigned_at), 'PPp', { locale: fr })}
                        {assignment.completed_at && (
                          <div>Terminée le {format(new Date(assignment.completed_at), 'PPp', { locale: fr })}</div>
                        )}
                        {assignment.validated_at && (
                          <div>Validée le {format(new Date(assignment.validated_at), 'PPp', { locale: fr })}</div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex space-x-2">
                        {isAssignedToMe && assignment.status === 'assigned' && (
                          <Button 
                            onClick={() => completePunishmentMutation.mutate(assignment.id)}
                            disabled={completePunishmentMutation.isPending}
                            className="flex-1"
                            size="sm"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Marquer terminée
                          </Button>
                        )}
                        {isAssignedByMe && assignment.status === 'completed' && (
                          <Button 
                            onClick={() => validatePunishmentMutation.mutate(assignment.id)}
                            disabled={validatePunishmentMutation.isPending}
                            className="flex-1"
                            size="sm"
                          >
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Valider
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Available Punishments (for assignment) */}
        <TabsContent value="available">
          {profile?.role === 'dominant' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {punishments?.filter(p => p.created_by === user?.id).map((punishment) => {
                const IconComponent = getSeverityIcon(punishment.severity);
                
                return (
                  <Card key={punishment.id} className="border-l-4 border-l-primary">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center space-x-2">
                          <IconComponent className="w-5 h-5" />
                          <span>{punishment.title}</span>
                        </span>
                        <Badge variant="outline" className={getSeverityColor(punishment.severity)}>
                          {getSeverityLabel(punishment.severity)}
                        </Badge>
                      </CardTitle>
                      {punishment.description && (
                        <p className="text-muted-foreground text-sm">{punishment.description}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="w-fit">
                          {getCategoryLabel(punishment.category)}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Button 
                        onClick={() => {
                          setSelectedPunishment(punishment);
                          setIsAssignDialogOpen(true);
                        }}
                        className="w-full"
                        size="sm"
                      >
                        <Zap className="w-4 h-4 mr-2" />
                        Assigner
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Ban className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Accès restreint</h3>
                <p className="text-muted-foreground">
                  Seuls les dominants peuvent voir les punitions disponibles.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Created Punishments */}
        <TabsContent value="created">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {punishments?.filter(p => p.created_by === user?.id).map((punishment) => {
              const IconComponent = getSeverityIcon(punishment.severity);
              
              return (
                <Card key={punishment.id} className="border-l-4 border-l-muted">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center space-x-2">
                        <IconComponent className="w-5 h-5" />
                        <span>{punishment.title}</span>
                      </span>
                      <Badge variant="outline" className={getSeverityColor(punishment.severity)}>
                        {getSeverityLabel(punishment.severity)}
                      </Badge>
                    </CardTitle>
                    {punishment.description && (
                      <p className="text-muted-foreground text-sm">{punishment.description}</p>
                    )}
                    <div className="flex items-center justify-between">
                      <Badge variant="secondary" className="w-fit">
                        {getCategoryLabel(punishment.category)}
                      </Badge>
                      <div className="text-xs text-muted-foreground">
                        Créée le {format(new Date(punishment.created_at), 'PPp', { locale: fr })}
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>

      {/* Assign Punishment Dialog */}
      <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assigner une punition</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedPunishment && (
              <div className="p-4 bg-muted rounded-lg">
                <h4 className="font-semibold">{selectedPunishment.title}</h4>
                {selectedPunishment.description && (
                  <p className="text-sm text-muted-foreground">{selectedPunishment.description}</p>
                )}
              </div>
            )}
            <div>
              <Label htmlFor="notes">Notes (optionnel)</Label>
              <Textarea
                id="notes"
                value={assignmentNotes}
                onChange={(e) => setAssignmentNotes(e.target.value)}
                placeholder="Instructions ou commentaires supplémentaires..."
              />
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAssignDialogOpen(false);
                  setSelectedPunishment(null);
                  setAssignmentNotes('');
                }}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                onClick={handleAssignPunishment}
                disabled={assignPunishmentMutation.isPending}
                className="flex-1"
              >
                {assignPunishmentMutation.isPending ? "Assignation..." : "Assigner"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Punishments;