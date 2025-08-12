import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Gift, Check, X, Clock, User, ArrowLeft, Crown } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface RewardPurchase {
  id: string;
  reward_id: string;
  user_id: string;
  points_spent: number;
  purchased_at: string;
  status: 'pending' | 'granted' | 'used';
  reward?: {
    title: string;
    description?: string;
    category: string;
  };
  user_profile?: {
    display_name: string;
  };
}

const ManageRewards = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedPurchase, setSelectedPurchase] = useState<RewardPurchase | null>(null);
  const [isStatusDialogOpen, setIsStatusDialogOpen] = useState(false);
  const [statusNotes, setStatusNotes] = useState('');

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

  // Get partnerships where user is dominant
  const { data: partnerships } = useQuery({
    queryKey: ['dominantPartnerships', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('partnerships')
        .select('submissive_id')
        .eq('dominant_id', user.id)
        .eq('status', 'accepted');

      if (error) throw error;
      return data;
    },
    enabled: !!user && profile?.role === 'dominant'
  });

  // Get reward purchases from submissives
  const { data: rewardPurchases, isLoading } = useQuery({
    queryKey: ['submissiveRewardPurchases', partnerships],
    queryFn: async () => {
      if (!partnerships || partnerships.length === 0) return [];
      
      const submissiveIds = partnerships.map(p => p.submissive_id);
      
      const { data, error } = await supabase
        .from('reward_purchases')
        .select(`
          *,
          rewards (
            title,
            description,
            category
          )
        `)
        .in('user_id', submissiveIds)
        .order('purchased_at', { ascending: false });

      if (error) throw error;

      // Get user profiles separately
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, display_name')
        .in('user_id', submissiveIds);

      // Merge the data
      const purchasesWithProfiles = data?.map(purchase => ({
        ...purchase,
        user_profile: profiles?.find(p => p.user_id === purchase.user_id)
      })) || [];

      return purchasesWithProfiles as RewardPurchase[];
    },
    enabled: !!partnerships && partnerships.length > 0
  });

  // Update purchase status mutation
  const updateStatusMutation = useMutation({
    mutationFn: async ({ purchaseId, newStatus }: { purchaseId: string; newStatus: string }) => {
      const { error } = await supabase
        .from('reward_purchases')
        .update({ status: newStatus })
        .eq('id', purchaseId);

      if (error) throw error;
    },
    onSuccess: (_, { newStatus }) => {
      queryClient.invalidateQueries({ queryKey: ['submissiveRewardPurchases'] });
      setIsStatusDialogOpen(false);
      setSelectedPurchase(null);
      setStatusNotes('');
      
      const statusLabels = {
        granted: 'accordée',
        used: 'marquée comme utilisée',
        pending: 'remise en attente'
      };
      
      toast({
        title: "Statut mis à jour !",
        description: `La récompense a été ${statusLabels[newStatus as keyof typeof statusLabels]}.`,
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le statut.",
        variant: "destructive",
      });
    }
  });

  const handleUpdateStatus = (newStatus: string) => {
    if (!selectedPurchase) return;
    updateStatusMutation.mutate({ purchaseId: selectedPurchase.id, newStatus });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-600 border-yellow-200';
      case 'granted': return 'bg-green-500/10 text-green-600 border-green-200';
      case 'used': return 'bg-gray-500/10 text-gray-600 border-gray-200';
      default: return 'bg-gray-500/10 text-gray-600 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending': return 'En attente';
      case 'granted': return 'Accordée';
      case 'used': return 'Utilisée';
      default: return status;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'pleasure': return '💕';
      case 'experience': return '⭐';
      case 'material': return '🛍️';
      case 'relaxation': return '☕';
      default: return '🎁';
    }
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
              Gestion des récompenses
            </h1>
          </div>
          
          <Card className="shadow-soft">
            <CardContent className="py-8 text-center">
              <Crown className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Vous devez avoir un partenariat actif pour gérer les récompenses
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <div className="container mx-auto py-8">Chargement...</div>;
  }

  const pendingPurchases = rewardPurchases?.filter(p => p.status === 'pending') || [];
  const grantedPurchases = rewardPurchases?.filter(p => p.status === 'granted') || [];
  const usedPurchases = rewardPurchases?.filter(p => p.status === 'used') || [];

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center space-x-4">
        <Button variant="ghost" onClick={() => navigate('/')}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        <div>
          <h1 className="text-3xl font-bold gradient-passion bg-clip-text text-transparent">
            Gestion des récompenses
          </h1>
          <p className="text-muted-foreground">
            Gérez les récompenses achetées par vos soumis(es)
          </p>
        </div>
      </div>

      <Tabs defaultValue="pending" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending" className="flex items-center space-x-2">
            <Clock className="w-4 h-4" />
            <span>En attente ({pendingPurchases.length})</span>
          </TabsTrigger>
          <TabsTrigger value="granted" className="flex items-center space-x-2">
            <Check className="w-4 h-4" />
            <span>Accordées ({grantedPurchases.length})</span>
          </TabsTrigger>
          <TabsTrigger value="used" className="flex items-center space-x-2">
            <Gift className="w-4 h-4" />
            <span>Utilisées ({usedPurchases.length})</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending">
          {pendingPurchases.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Clock className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Aucune demande en attente</h3>
                <p className="text-muted-foreground">
                  Toutes les récompenses ont été traitées
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {pendingPurchases.map((purchase) => (
                <Card key={purchase.id} className="border-l-4 border-l-yellow-500">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="text-2xl">
                          {getCategoryIcon(purchase.reward?.category || '')}
                        </div>
                        <div>
                          <h3 className="font-semibold flex items-center space-x-2">
                            <span>{purchase.reward?.title || 'Récompense supprimée'}</span>
                            <Badge variant="outline" className="text-xs">
                              -{purchase.points_spent} pts
                            </Badge>
                          </h3>
                          {purchase.reward?.description && (
                            <p className="text-sm text-muted-foreground">{purchase.reward.description}</p>
                          )}
                          <div className="flex items-center space-x-2 mt-2">
                            <User className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {purchase.user_profile?.display_name}
                            </span>
                            <span className="text-sm text-muted-foreground">•</span>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(purchase.purchased_at), 'PPP à HH:mm', { locale: fr })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          onClick={() => handleUpdateStatus('granted')}
                          disabled={updateStatusMutation.isPending}
                        >
                          <Check className="w-4 h-4 mr-1" />
                          Accorder
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => {
                            setSelectedPurchase(purchase);
                            setIsStatusDialogOpen(true);
                          }}
                        >
                          <X className="w-4 h-4 mr-1" />
                          Refuser
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="granted">
          {grantedPurchases.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Check className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Aucune récompense accordée</h3>
                <p className="text-muted-foreground">
                  Les récompenses accordées apparaîtront ici
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {grantedPurchases.map((purchase) => (
                <Card key={purchase.id} className="border-l-4 border-l-green-500">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="text-2xl">
                          {getCategoryIcon(purchase.reward?.category || '')}
                        </div>
                        <div>
                          <h3 className="font-semibold flex items-center space-x-2">
                            <span>{purchase.reward?.title || 'Récompense supprimée'}</span>
                            <Badge variant="outline" className="text-xs">
                              -{purchase.points_spent} pts
                            </Badge>
                          </h3>
                          {purchase.reward?.description && (
                            <p className="text-sm text-muted-foreground">{purchase.reward.description}</p>
                          )}
                          <div className="flex items-center space-x-2 mt-2">
                            <User className="w-3 h-3 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">
                              {purchase.user_profile?.display_name}
                            </span>
                            <span className="text-sm text-muted-foreground">•</span>
                            <span className="text-sm text-muted-foreground">
                              {format(new Date(purchase.purchased_at), 'PPP à HH:mm', { locale: fr })}
                            </span>
                          </div>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpdateStatus('used')}
                        disabled={updateStatusMutation.isPending}
                      >
                        Marquer comme utilisée
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="used">
          {usedPurchases.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Gift className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Aucune récompense utilisée</h3>
                <p className="text-muted-foreground">
                  L'historique des récompenses utilisées apparaîtra ici
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {usedPurchases.map((purchase) => (
                <Card key={purchase.id} className="border-l-4 border-l-gray-400">
                  <CardContent className="p-6">
                    <div className="flex items-center space-x-4">
                      <div className="text-2xl opacity-60">
                        {getCategoryIcon(purchase.reward?.category || '')}
                      </div>
                      <div>
                        <h3 className="font-semibold flex items-center space-x-2">
                          <span>{purchase.reward?.title || 'Récompense supprimée'}</span>
                          <Badge variant="outline" className="text-xs">
                            -{purchase.points_spent} pts
                          </Badge>
                          <Badge variant="secondary">Utilisée</Badge>
                        </h3>
                        {purchase.reward?.description && (
                          <p className="text-sm text-muted-foreground">{purchase.reward.description}</p>
                        )}
                        <div className="flex items-center space-x-2 mt-2">
                          <User className="w-3 h-3 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">
                            {purchase.user_profile?.display_name}
                          </span>
                          <span className="text-sm text-muted-foreground">•</span>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(purchase.purchased_at), 'PPP à HH:mm', { locale: fr })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Refusal Dialog */}
      <Dialog open={isStatusDialogOpen} onOpenChange={setIsStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refuser la récompense</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Vous êtes sur le point de refuser cette demande de récompense. 
              Les points seront remboursés automatiquement.
            </p>
            <div>
              <Label htmlFor="notes">Raison du refus (optionnelle)</Label>
              <Textarea
                id="notes"
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                placeholder="Expliquez pourquoi vous refusez cette récompense..."
              />
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsStatusDialogOpen(false);
                  setSelectedPurchase(null);
                  setStatusNotes('');
                }}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button
                onClick={() => handleUpdateStatus('pending')}
                disabled={updateStatusMutation.isPending}
                variant="destructive"
                className="flex-1"
              >
                Confirmer le refus
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ManageRewards;
