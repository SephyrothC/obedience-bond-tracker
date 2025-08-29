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
import { Gift, Plus, ArrowLeft, Heart, Star, Coffee, ShoppingBag, User, Crown, Settings } from 'lucide-react';
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
  reward?: Reward;
}

const Rewards = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'available' | 'purchased'>('available');

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

  // Get available users for reward creation (self + partners)
  const { data: availableUsers } = useQuery({
    queryKey: ['availableUsers', partnerships],
    queryFn: async () => {
      const users = [{ user_id: user?.id, display_name: 'Moi-même' }];
      
      if (partnerships) {
        partnerships.forEach(partnership => {
          if (partnership.dominant_id === user?.id) {
            users.push({
              user_id: partnership.submissive_id,
              display_name: partnership.submissive_profile?.display_name || 'Partenaire'
            });
          } else {
            users.push({
              user_id: partnership.dominant_id,
              display_name: partnership.dominant_profile?.display_name || 'Partenaire'
            });
          }
        });
      }
      
      return users;
    },
    enabled: !!partnerships
  });

  // Get available rewards (for current user or created by current user)
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

  // Get purchased rewards
  const { data: purchasedRewards } = useQuery({
    queryKey: ['purchasedRewards', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reward_purchases')
        .select(`
          *,
          rewards(*)
        `)
        .eq('user_id', user?.id)
        .order('purchased_at', { ascending: false });
      
      if (error) throw error;
      return data as RewardPurchase[];
    },
    enabled: !!user?.id
  });

  // Create reward mutation
  const createRewardMutation = useMutation({
    mutationFn: async (rewardData: typeof newReward) => {
      const { error } = await supabase
        .from('rewards')
        .insert({
          ...rewardData,
          created_by: user?.id,
          for_user: rewardData.for_user || user?.id
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

  // Purchase reward mutation
  const purchaseRewardMutation = useMutation({
    mutationFn: async (reward: Reward) => {
      if (!userPoints || userPoints < reward.points_cost) {
        throw new Error('Points insuffisants');
      }

      // Create purchase record
      const { error: purchaseError } = await supabase
        .from('reward_purchases')
        .insert({
          reward_id: reward.id,
          user_id: user?.id,
          points_spent: reward.points_cost,
          status: 'pending'
        });
      
      if (purchaseError) throw purchaseError;

      // Deduct points
      const { error: pointsError } = await supabase
        .from('points_transactions')
        .insert({
          user_id: user?.id,
          created_by: user?.id,
          type: 'penalty',
          points: -reward.points_cost,
          reason: `Achat de récompense: ${reward.title}`,
          reference_id: reward.id
        });
      
      if (pointsError) throw pointsError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['points'] });
      queryClient.invalidateQueries({ queryKey: ['purchasedRewards'] });
      toast({
        title: "Récompense achetée !",
        description: "Votre récompense a été achetée avec succès.",
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

  const handleCreateReward = () => {
    if (!newReward.title.trim()) return;
    createRewardMutation.mutate(newReward);
  };

  const handlePurchaseReward = (reward: Reward) => {
    purchaseRewardMutation.mutate(reward);
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

  // Filter rewards that can be purchased by current user
  const availableRewards = rewards?.filter(reward => reward.for_user === user?.id) || [];
  const createdRewards = rewards?.filter(reward => reward.created_by === user?.id) || [];

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
                ? "Créez et gérez les récompenses"
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
            <Button onClick={() => navigate('/manage-rewards')} variant="outline">
              <Settings className="w-4 h-4 mr-2" />
              Gérer les achats
            </Button>
          )}
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
                    disabled={createRewardMutation.isPending || !newReward.title.trim()}
                    className="flex-1"
                  >
                    {createRewardMutation.isPending ? "Création..." : "Créer"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Tabs defaultValue="available" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="available">Disponibles ({availableRewards.length})</TabsTrigger>
          <TabsTrigger value="purchased">Mes achats ({purchasedRewards?.length || 0})</TabsTrigger>
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
                    ? "Créez des récompenses pour vous motiver ou motiver vos partenaires"
                    : "Aucune récompense n'est disponible pour le moment"
                  }
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Créer une récompense
                </Button>
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
                    </CardHeader>
                    <CardContent>
                      <Button
                        onClick={() => handlePurchaseReward(reward)}
                        disabled={!canAfford || purchaseRewardMutation.isPending}
                        className="w-full"
                        variant={canAfford ? 'default' : 'outline'}
                      >
                        {canAfford ? 'Échanger' : 'Points insuffisants'}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Purchased Rewards */}
        <TabsContent value="purchased">
          {!purchasedRewards || purchasedRewards.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <ShoppingBag className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Aucun achat</h3>
                <p className="text-muted-foreground">
                  Vous n'avez encore acheté aucune récompense
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {purchasedRewards.map((purchase) => {
                const IconComponent = getCategoryIcon(purchase.reward?.category || 'pleasure');
                
                return (
                  <Card key={purchase.id}>
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <IconComponent className="w-8 h-8 text-primary" />
                          <div>
                            <h3 className="font-semibold">{purchase.reward?.title || 'Récompense supprimée'}</h3>
                            {purchase.reward?.description && (
                              <p className="text-sm text-muted-foreground">{purchase.reward.description}</p>
                            )}
                            <p className="text-xs text-muted-foreground mt-1">
                              Achetée le {format(new Date(purchase.purchased_at), 'PPP à HH:mm', { locale: fr })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline">
                            -{purchase.points_spent} pts
                          </Badge>
                          <Badge className={getStatusColor(purchase.status)}>
                            {getStatusLabel(purchase.status)}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Created Rewards */}
        <TabsContent value="created">
          {createdRewards.length === 0 ? (
            <Card>
              <CardContent className="text-center py-12">
                <Gift className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Aucune récompense créée</h3>
                <p className="text-muted-foreground mb-4">
                  Créez des récompenses pour vous ou vos partenaires
                </p>
                <Button onClick={() => setIsCreateDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" />
                  Créer une récompense
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {createdRewards.map((reward) => {
                const IconComponent = getCategoryIcon(reward.category);
                const isForSelf = reward.for_user === user?.id;
                
                return (
                  <Card key={reward.id} className="border-l-4 border-l-primary">
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
                      <div className="flex items-center space-x-2">
                        {isForSelf ? (
                          <User className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <Crown className="w-4 h-4 text-primary" />
                        )}
                        <span className="text-sm text-muted-foreground">
                          {isForSelf ? 'Pour moi' : 'Pour mon partenaire'}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-xs text-muted-foreground">
                        Créée le {format(new Date(reward.created_at), 'PPP', { locale: fr })}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Rewards;
