import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Zap, Plus, ArrowLeft, AlertTriangle, Clock, Ban } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';

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
}

const Punishments = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isApplyDialogOpen, setIsApplyDialogOpen] = useState(false);
  const [selectedPunishment, setSelectedPunishment] = useState<Punishment | null>(null);
  const [pointsToDeduct, setPointsToDeduct] = useState(0);
  const [punishmentReason, setPunishmentReason] = useState('');

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

  // Get submissives for dominant users
  const { data: submissives } = useQuery({
    queryKey: ['submissives', user?.id],
    queryFn: async () => {
      if (profile?.role !== 'dominant') return [];
      
      const { data, error } = await supabase
        .from('partnerships')
        .select(`
          submissive_id,
          profiles!partnerships_submissive_id_fkey(display_name, user_id)
        `)
        .eq('dominant_id', user?.id)
        .eq('status', 'accepted');
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && profile?.role === 'dominant'
  });

  // Get available punishments
  const { data: punishments, isLoading } = useQuery({
    queryKey: ['punishments', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('punishments')
        .select('*')
        .eq('for_user', user?.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Punishment[];
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
          for_user: punishmentData.for_user || user?.id
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

  // Apply punishment mutation
  const applyPunishmentMutation = useMutation({
    mutationFn: async ({ punishment, points, reason }: { punishment: Punishment; points: number; reason: string }) => {
      // Create points transaction for penalty
      const { error } = await supabase
        .from('points_transactions')
        .insert({
          user_id: punishment.for_user,
          created_by: user?.id,
          type: 'penalty',
          points: -Math.abs(points),
          reason: `Punition appliquée: ${punishment.title} - ${reason}`,
          reference_id: punishment.id
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['points'] });
      setIsApplyDialogOpen(false);
      setSelectedPunishment(null);
      setPointsToDeduct(0);
      setPunishmentReason('');
      toast({
        title: "Punition appliquée !",
        description: "La punition a été appliquée avec succès.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'appliquer la punition.",
        variant: "destructive",
      });
    }
  });

  const handleCreatePunishment = () => {
    if (!newPunishment.title.trim()) return;
    createPunishmentMutation.mutate(newPunishment);
  };

  const handleApplyPunishment = () => {
    if (!selectedPunishment || pointsToDeduct <= 0 || !punishmentReason.trim()) return;
    applyPunishmentMutation.mutate({
      punishment: selectedPunishment,
      points: pointsToDeduct,
      reason: punishmentReason
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
            <h1 className="text-3xl font-bold">Punitions</h1>
            <p className="text-muted-foreground">
              {profile?.role === 'dominant' 
                ? "Gérez les punitions pour vos soumis(es)"
                : "Vos punitions possibles"
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
                      <SelectValue placeholder="Sélectionner une personne" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={user?.id || ''}>Moi-même</SelectItem>
                      {submissives?.map((sub) => (
                        <SelectItem key={sub.submissive_id} value={sub.submissive_id}>
                          {sub.profiles?.display_name}
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
                    disabled={createPunishmentMutation.isPending || !newPunishment.title.trim()}
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

      {!punishments || punishments.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Zap className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Aucune punition disponible</h3>
            <p className="text-muted-foreground mb-4">
              {profile?.role === 'dominant' 
                ? "Créez des punitions pour maintenir la discipline"
                : "Aucune punition n'a été définie"
              }
            </p>
            {profile?.role === 'dominant' && (
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Créer une punition
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {punishments.map((punishment) => {
            const IconComponent = getSeverityIcon(punishment.severity);
            
            return (
              <Card key={punishment.id} className="border-l-4 border-l-destructive">
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
                    <p className="text-muted-foreground">{punishment.description}</p>
                  )}
                  <Badge variant="secondary" className="w-fit">
                    {getCategoryLabel(punishment.category)}
                  </Badge>
                </CardHeader>
                {profile?.role === 'dominant' && (
                  <CardContent>
                    <Button
                      onClick={() => {
                        setSelectedPunishment(punishment);
                        setIsApplyDialogOpen(true);
                      }}
                      variant="destructive"
                      className="w-full"
                    >
                      Appliquer la punition
                    </Button>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Apply Punishment Dialog */}
      <Dialog open={isApplyDialogOpen} onOpenChange={setIsApplyDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Appliquer une punition</DialogTitle>
          </DialogHeader>
          {selectedPunishment && (
            <div className="space-y-4">
              <div className="p-4 border rounded-lg bg-destructive/5">
                <h3 className="font-medium text-destructive">{selectedPunishment.title}</h3>
                {selectedPunishment.description && (
                  <p className="text-sm text-muted-foreground mt-1">{selectedPunishment.description}</p>
                )}
              </div>
              <div>
                <Label htmlFor="points">Points à retirer</Label>
                <Input
                  id="points"
                  type="number"
                  min="0"
                  value={pointsToDeduct}
                  onChange={(e) => setPointsToDeduct(parseInt(e.target.value) || 0)}
                  placeholder="Nombre de points à déduire"
                />
              </div>
              <div>
                <Label htmlFor="reason">Raison de la punition</Label>
                <Textarea
                  id="reason"
                  value={punishmentReason}
                  onChange={(e) => setPunishmentReason(e.target.value)}
                  placeholder="Expliquez pourquoi cette punition est appliquée..."
                />
              </div>
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsApplyDialogOpen(false);
                    setSelectedPunishment(null);
                    setPointsToDeduct(0);
                    setPunishmentReason('');
                  }}
                  className="flex-1"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleApplyPunishment}
                  disabled={
                    applyPunishmentMutation.isPending || 
                    pointsToDeduct <= 0 || 
                    !punishmentReason.trim()
                  }
                  variant="destructive"
                  className="flex-1"
                >
                  {applyPunishmentMutation.isPending ? "Application..." : "Appliquer"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Punishments;
