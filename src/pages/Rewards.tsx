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
import { Gift, Plus, ArrowLeft, Heart, Star, Coffee, ShoppingBag, User, Crown, Settings, CheckCircle, Clock } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Reward {
  id: string;
  title: string;
  description?: string;
  points_cost: number;
  category: string;
  created_by: string;
  for_user: string;
  is_active: boolean;
  created_at: string;
}

interface RewardPurchase {
  id: string;
  reward_id: string;
  user_id: string;
  points_spent: number;
  purchased_at: string;
  status: 'pending' | 'granted' | 'used';
  validated_by?: string;
  validated_at?: string;
  reward?: Reward;
}

const Rewards = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  // Form state for new reward
  const [newReward, setNewReward] = useState({
    title: '',
    description: '',
    points_cost: 10,
    category: 'pleasure',
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

  // Get partners for reward creation
  const { data: availableUsers } = useQuery({
    queryKey: ['availableUsers', partnerships],
    queryFn: async () => {
      const users: Array<{user_id: string, display_name: string}> = [];
      
      if (partnerships) {
        partnerships.forEach(partnership => {
          if (partnership.dominant_id === user?.id) {
            users.push({
              user_id: partnership.submissive_id,
              display_name: partnership.submissive_profile?.display_name || 'Soumis(e)'
            });
            users.push({
              user_id: partnership.dominant_id,
              display_name: 'Moi-même'
            });
          } else {
            users.push({
              user_id: partnership.dominant_id,
              display_name: partnership.dominant_profile?.display_name || 'Dominant(e)'
            });
            users.push({
              user_id: partnership.submissive_id,
              display_name: 'Moi-même'
            });
          }
        });
      }
      
      // Remove duplicates
      const uniqueUsers = users.filter((user, index, self) => 
        index === self.findIndex(u => u.user_id === user.user_id)
      );
      
      return uniqueUsers;
    },
    enabled: !!partnerships
  });

  // Get available rewards (for current user or involving current user)
  const { data: rewards, isLoading } = useQuery({
    queryKey: ['rewards', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('rewards')
        .select('*')
        .or(`for_user.eq.${user?.id},created_by.eq.${user?.id}`)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as Reward[];
    },
    enabled: !!user?.id
  });

  // Get user's current points
  const { data: userPoints } = useQuery({
    queryKey: ['points', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('points_transactions')
        .select('points')
        .eq('user_id', user?.id);
      
      if (error) throw error;
      
      const totalPoints = data?.reduce((sum, transaction) => sum + transaction.points, 0) || 0;
      return totalPoints;
    },
    enabled: !!user?.id
  });

  // Get reward purchases (including partner purchases for validation)
  const { data: rewardPurchases } = useQuery({
    queryKey: ['rewardPurchases', user?.id],
    queryFn: async () => {
      // Get both own purchases and purchases from partners that need validation
      const partnerIds = partnerships?.map(p => 
        p.dominant_id === user?.id ? p.submissive_id : p.dominant_id
      ) || [];
      
      const userIds = [user?.id, ...partnerIds].filter(Boolean);
      
      const { data, error } = await supabase
        .from('reward_purchases')
        .select('*')
        .in('user_id', userIds)
        .order('purchased_at', { ascending: false });
      
      if (error) throw error;

      // Get rewards and buyer profiles separately
      const enrichedPurchases = await Promise.all(
        (data || []).map(async (purchase) => {
          const [rewardResult, profileResult] = await Promise.all([
            supabase.from('rewards').select('*').eq('id', purchase.reward_id).single(),
            supabase.from('profiles').select('display_name').eq('user_id', purchase.user_id).single()
          ]);
          
          return {
            ...purchase,
            reward: rewardResult.data,
            buyer: profileResult.data
          };
        })
      );
      
      return enrichedPurchases as (RewardPurchase & { buyer: { display_name: string } })[];
    },
    enabled: !!user?.id && !!partnerships
  });

  // Create reward mutation (only for dominants)
  const createRewardMutation = useMutation({
    mutationFn: async (rewardData: typeof newReward) => {
      const { error } = await supabase
        .from('rewards')
        .insert({
          ...rewardData,
          created_by: user?.id,
          for_user: rewardData.for_user
        });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rewards'] });
      setIsCreateDialogOpen(false);
      setNewReward({ title: '', description: '', points_cost: 10, category: 'pleasure', for_user: '' });
      toast({
        title: "Récompense créée !",
        description: "La récompense a été créée avec succès.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de créer la récompense.",
        variant: "destructive",
      });
    }
  });

  // Purchase reward mutation (both partners can purchase)
  const purchaseRewardMutation = useMutation({
    mutationFn: async ({ reward, buyerId }: { reward: Reward; buyerId: string }) => {
      // Get buyer's points
      const { data: pointsData, error: pointsError } = await supabase
        .from('points_transactions')
        .select('points')
        .eq('user_id', buyerId);
      
      if (pointsError) throw pointsError;
      
      const totalPoints = pointsData?.reduce((sum, transaction) => sum + transaction.points, 0) || 0;
      
      if (totalPoints < reward.points_cost) {
        throw new Error('Points insuffisants');
      }

      // Create purchase record
      const { error: purchaseError } = await supabase
        .from('reward_purchases')
        .insert({
          reward_id: reward.id,
          user_id: buyerId,
          points_spent: reward.points_cost,
          status: 'pending'
        });
      
      if (purchaseError) throw purchaseError;

      // Deduct points
      const { error: pointsDeductError } = await supabase
        .from('points_transactions')
        .insert({
          user_id: buyerId,
          created_by: user?.id,
          type: 'penalty',
          points: -reward.points_cost,
          reason: `Achat de récompense: ${reward.title}`,
          reference_id: reward.id
        });
      
      if (pointsDeductError) throw pointsDeductError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['points'] });
      queryClient.invalidateQueries({ queryKey: ['rewardPurchases'] });
      toast({
        title: "Récompense achetée !",
        description: "La récompense a été achetée avec succès.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'acheter la récompense.",
        variant: "destructive",
      });
    }
  });

  // Validate reward purchase mutation
  const validatePurchaseMutation = useMutation({
    mutationFn: async (purchaseId: string) => {
      const { error } = await supabase
        .from('reward_purchases')
        .update({
          status: 'granted',
          validated_by: user?.id,
          validated_at: new Date().toISOString()
        })
        .eq('id', purchaseId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rewardPurchases'] });
      toast({
        title: "Récompense validée !",
        description: "La récompense a été validée avec succès.",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de valider la récompense.",
        variant: "destructive",
      });
    }
  });

  const handleCreateReward = () => {
    if (!newReward.title.trim() || !newReward.for_user) return;
    createRewardMutation.mutate(newReward);
  };

  const handlePurchaseReward = (reward: Reward, buyerId?: string) => {
    purchaseRewardMutation.mutate({ reward, buyerId: buyerId || user?.id || '' });
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'pleasure': return Heart;
      case 'experience': return Star;
      case 'material': return ShoppingBag;
      case 'relaxation': return Coffee;
      default: return Gift;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'pleasure': return 'bg-pink-500/10 text-pink-600 border-pink-200';
      case 'experience': return 'bg-yellow-500/10 text-yellow-600 border-yellow-200';
      case 'material': return 'bg-blue-500/10 text-blue-600 border-blue-200';
      case 'relaxation': return 'bg-green-500/10 text-green-600 border-green-200';
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-600';
      case 'granted': return 'bg-green-500/10 text-green-600';
      case 'used': return 'bg-gray-500/10 text-gray-600';
      default: return 'bg-gray-500/10 text-gray-600';
    }
  };

  // Filter rewards and purchases
  const availableRewards = rewards?.filter(reward => reward.for_user === user?.id) || [];
  const createdRewards = rewards?.filter(reward => reward.created_by === user?.id) || [];
  const myPurchases = rewardPurchases?.filter(p => p.user_id === user?.id) || [];
  const partnerPurchases = rewardPurchases?.filter(p => p.user_id !== user?.id) || [];

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
              Récompenses
            </h1>
            <p className="text-muted-foreground">
              {profile?.role === 'dominant' 
                ? "Créez et gérez les récompenses pour vos partenaires"
                : "Échangez vos points contre des récompenses"
              }
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Vos points</p>
            <p className="text-2xl font-bold text-primary">{userPoints || 0}</p>
          </div>
          {profile?.role === 'dominant' && (
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="w-4 h-4 mr-2" />
                  Nouvelle récompense
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Créer une récompense</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="title">Titre</Label>
                    <Input
                      id="title"
                      value={newReward.title}
                      onChange={(e) => setNewReward({ ...newReward, title: e.target.value })}
                      placeholder="Titre de la récompense"
                    />
                  </div>
                  <div>
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={newReward.description}
                      onChange={(e) => setNewReward({ ...newReward, description: e.target.value })}
                      placeholder="Description de la récompense"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="points">Coût en points</Label>
                      <Input
                        id="points"
                        type="number"
                        min="1"
                        value={newReward.points_cost}
                        onChange={(e) => setNewReward({ ...newReward, points_cost: parseInt(e.target.value) || 1 })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="category">Catégorie</Label>
                      <Select value={newReward.category} onValueChange={(value) => setNewReward({ ...newReward, category: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pleasure">Plaisir</SelectItem>
                          <SelectItem value="experience">Expérience</SelectItem>
                          <SelectItem value="material">Matériel</SelectItem>
                          <SelectItem value="relaxation">Relaxation</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="for_user">Pour qui</Label>
                    <Select value={newReward.for_user} onValueChange={(value) => setNewReward({ ...newReward, for_user: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Sélectionner un bénéficiaire" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableUsers?.map((user) => (
                          <SelectItem key={user.user_id} value={user.user_id}>
                            {user.display_name}
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
                      onClick={handleCreateReward}
                      disabled={createRewardMutation.isPending || !newReward.title.trim() || !newReward.for_user}
                      className="flex-1"
                    >
                      {createRewardMutation.isPending ? "Création..." : "Créer"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      <Tabs defaultValue="available" className="space-y-6">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="available">Disponibles ({availableRewards.length})</TabsTrigger>
          <TabsTrigger value="purchases">Mes achats ({myPurchases.length})</TabsTrigger>
          {partnerships && partnerships.length > 0 && (
            <TabsTrigger value="partner-purchases">Achats partenaire ({partnerPurchases.length})</TabsTrigger>
          )}
          <TabsTrigger value="created">Créées ({createdRewards.length})</TabsTrigger>
        </TabsList>

        {/* Available Rewards */}
        <TabsContent value="available">
          {availableRewards.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Gift className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Aucune récompense disponible</h3>
                <p className="text-muted-foreground mb-4">
                  {profile?.role === 'dominant' 
                    ? "Créez des récompenses pour motiver vos partenaires"
                    : "Aucune récompense n'est disponible pour le moment"
                  }
                </p>
                {profile?.role === 'dominant' && (
                  <Button onClick={() => setIsCreateDialogOpen(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Créer une récompense
                  </Button>
                )}
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableRewards.map((reward) => {
                const IconComponent = getCategoryIcon(reward.category);
                const canAfford = (userPoints || 0) >= reward.points_cost;
                
                return (
                  <Card key={reward.id} className={`${!canAfford ? 'opacity-60' : ''}`}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span className="flex items-center space-x-2">
                          <IconComponent className="w-5 h-5" />
                          <span>{reward.title}</span>
                        </span>
                        <Badge variant="outline" className={getCategoryColor(reward.category)}>
                          {reward.points_cost} pts
                        </Badge>
                      </CardTitle>
                      {reward.description && (
                        <p className="text-muted-foreground text-sm">{reward.description}</p>
                      )}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                          {reward.created_by === user?.id ? (
                            <>
                              <User className="w-3 h-3" />
                              <span>Par moi</span>
                            </>
                          ) : (
                            <>
                              <Crown className="w-3 h-3" />
                              <span>Par mon dominant</span>
                            </>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <Button 
                        onClick={() => handlePurchaseReward(reward)}
                        disabled={!canAfford || purchaseRewardMutation.isPending}
                        className="w-full"
                        size="sm"
                      >
                        <Gift className="w-4 h-4 mr-2" />
                        {!canAfford ? 'Points insuffisants' : 'Acheter'}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* My Purchases */}
        <TabsContent value="purchases">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {myPurchases.map((purchase) => {
              const IconComponent = getCategoryIcon(purchase.reward?.category || 'pleasure');
              
              return (
                <Card key={purchase.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center space-x-2">
                        <IconComponent className="w-5 h-5" />
                        <span>{purchase.reward?.title}</span>
                      </span>
                      <Badge className={getStatusColor(purchase.status)}>
                        {getStatusLabel(purchase.status)}
                      </Badge>
                    </CardTitle>
                    {purchase.reward?.description && (
                      <p className="text-muted-foreground text-sm">{purchase.reward.description}</p>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Acheté le {format(new Date(purchase.purchased_at), 'PPp', { locale: fr })}
                      {purchase.validated_at && (
                        <div>Validé le {format(new Date(purchase.validated_at), 'PPp', { locale: fr })}</div>
                      )}
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Partner Purchases */}
        <TabsContent value="partner-purchases">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {partnerPurchases.map((purchase) => {
              const IconComponent = getCategoryIcon(purchase.reward?.category || 'pleasure');
              const canValidate = purchase.status === 'pending';
              
              return (
                <Card key={purchase.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center space-x-2">
                        <IconComponent className="w-5 h-5" />
                        <span>{purchase.reward?.title}</span>
                      </span>
                      <Badge className={getStatusColor(purchase.status)}>
                        {getStatusLabel(purchase.status)}
                      </Badge>
                    </CardTitle>
                    {purchase.reward?.description && (
                      <p className="text-muted-foreground text-sm">{purchase.reward.description}</p>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Acheté par {purchase.buyer?.display_name} le {format(new Date(purchase.purchased_at), 'PPp', { locale: fr })}
                      {purchase.validated_at && (
                        <div>Validé le {format(new Date(purchase.validated_at), 'PPp', { locale: fr })}</div>
                      )}
                    </div>
                  </CardHeader>
                  {canValidate && (
                    <CardContent>
                      <Button 
                        onClick={() => validatePurchaseMutation.mutate(purchase.id)}
                        disabled={validatePurchaseMutation.isPending}
                        className="w-full"
                        size="sm"
                      >
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Valider la récompense
                      </Button>
                    </CardContent>
                  )}
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* Created Rewards */}
        <TabsContent value="created">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {createdRewards.map((reward) => {
              const IconComponent = getCategoryIcon(reward.category);
              
              return (
                <Card key={reward.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <span className="flex items-center space-x-2">
                        <IconComponent className="w-5 h-5" />
                        <span>{reward.title}</span>
                      </span>
                      <Badge variant="outline" className={getCategoryColor(reward.category)}>
                        {reward.points_cost} pts
                      </Badge>
                    </CardTitle>
                    {reward.description && (
                      <p className="text-muted-foreground text-sm">{reward.description}</p>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Créé le {format(new Date(reward.created_at), 'PPp', { locale: fr })}
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Rewards;