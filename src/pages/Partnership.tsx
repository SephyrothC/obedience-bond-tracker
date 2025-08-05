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
import { Badge } from '@/components/ui/badge';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Heart, UserPlus, Check, X, Crown, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import PartnerSearch from '@/components/partnership/PartnerSearch';
import PartnershipStats from '@/components/partnership/PartnershipStats';

const inviteSchema = z.object({
  email: z.string().email('Email invalide')
});

type InviteFormData = z.infer<typeof inviteSchema>;

const Partnership = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<InviteFormData>({
    resolver: zodResolver(inviteSchema),
    defaultValues: {
      email: ''
    }
  });

  // Get user's profile
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

  // Get existing partnerships
  const { data: partnerships } = useQuery({
    queryKey: ['partnerships', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('partnerships')
        .select(`
          *,
          dominant_profile:profiles!partnerships_dominant_id_fkey(display_name, role),
          submissive_profile:profiles!partnerships_submissive_id_fkey(display_name, role)
        `)
        .or(`dominant_id.eq.${user.id},submissive_id.eq.${user.id}`)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

  // Get all profiles for inviting (only show opposite roles)
  const { data: availableProfiles } = useQuery({
    queryKey: ['availableProfiles', user?.id, profile?.role],
    queryFn: async () => {
      if (!user || !profile) return [];
      
      const targetRole = profile.role === 'dominant' ? 'submissive' : 'dominant';
      
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, display_name, role')
        .eq('role', targetRole)
        .neq('user_id', user.id);

      if (error) throw error;
      
      // Filter out already connected users
      const existingPartnerIds = partnerships?.map(p => 
        p.dominant_id === user.id ? p.submissive_id : p.dominant_id
      ) || [];
      
      return data.filter(p => !existingPartnerIds.includes(p.user_id));
    },
    enabled: !!user && !!profile && !!partnerships
  });

  // Create partnership mutation
  const createPartnershipMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      if (!user || !profile) throw new Error('User not authenticated');

      const partnershipData = profile.role === 'dominant' 
        ? { dominant_id: user.id, submissive_id: targetUserId }
        : { dominant_id: targetUserId, submissive_id: user.id };

      const { error } = await supabase
        .from('partnerships')
        .insert(partnershipData);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Demande envoyée !",
        description: "Votre demande de partenariat a été envoyée.",
      });
      queryClient.invalidateQueries({ queryKey: ['partnerships'] });
      queryClient.invalidateQueries({ queryKey: ['availableProfiles'] });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer la demande. Veuillez réessayer.",
        variant: "destructive",
      });
    }
  });

  // Update partnership status mutation
  const updatePartnershipMutation = useMutation({
    mutationFn: async ({ partnershipId, status }: { partnershipId: string, status: string }) => {
      const { error } = await supabase
        .from('partnerships')
        .update({ status })
        .eq('id', partnershipId);

      if (error) throw error;
    },
    onSuccess: (_, { status }) => {
      toast({
        title: status === 'accepted' ? "Partenariat accepté !" : "Demande refusée",
        description: status === 'accepted' 
          ? "Vous êtes maintenant connectés." 
          : "La demande a été refusée.",
      });
      queryClient.invalidateQueries({ queryKey: ['partnerships'] });
      queryClient.invalidateQueries({ queryKey: ['availableProfiles'] });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le partenariat.",
        variant: "destructive",
      });
    }
  });

  const getPartnershipStatusBadge = (partnership: any) => {
    const isCurrentUserDominant = partnership.dominant_id === user?.id;
    
    switch (partnership.status) {
      case 'pending':
        return (
          <Badge variant="outline" className="text-amber-600 border-amber-300">
            En attente
          </Badge>
        );
      case 'accepted':
        return (
          <Badge className="bg-accent text-accent-foreground">
            Actif
          </Badge>
        );
      case 'rejected':
        return (
          <Badge variant="destructive">
            Refusé
          </Badge>
        );
      default:
        return null;
    }
  };

  const getPartnerName = (partnership: any) => {
    const isCurrentUserDominant = partnership.dominant_id === user?.id;
    return isCurrentUserDominant 
      ? partnership.submissive_profile?.display_name 
      : partnership.dominant_profile?.display_name;
  };

  const getPartnerRole = (partnership: any) => {
    const isCurrentUserDominant = partnership.dominant_id === user?.id;
    return isCurrentUserDominant ? 'submissive' : 'dominant';
  };

  const canRespondToPartnership = (partnership: any) => {
    return partnership.status === 'pending' && partnership.submissive_id === user?.id;
  };

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold gradient-passion bg-clip-text text-transparent">
              Partenariats
            </h1>
            <p className="text-muted-foreground">
              Gérez vos liens avec vos partenaires BDSM
            </p>
          </div>
        </div>

        {/* Partnership Stats */}
        <PartnershipStats />

        <Tabs defaultValue="active" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="active">Actifs</TabsTrigger>
            <TabsTrigger value="pending">Demandes</TabsTrigger>
            <TabsTrigger value="search">Rechercher</TabsTrigger>
            <TabsTrigger value="invite">Inviter</TabsTrigger>
          </TabsList>

          {/* Active Partnerships */}
          <TabsContent value="active">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Heart className="w-5 h-5 text-destructive" />
                  <span>Partenariats actifs</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {partnerships?.filter(p => p.status === 'accepted').length === 0 ? (
                  <div className="text-center py-8 space-y-2">
                    <Heart className="w-12 h-12 text-muted-foreground mx-auto" />
                    <p className="text-muted-foreground">Aucun partenariat actif</p>
                    <p className="text-sm text-muted-foreground">
                      Commencez par envoyer une demande de partenariat
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {partnerships?.filter(p => p.status === 'accepted').map((partnership) => (
                      <div key={partnership.id} className="p-4 border rounded-lg bg-accent/5 border-accent/20">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {getPartnerRole(partnership) === 'dominant' ? (
                              <Crown className="w-5 h-5 text-primary" />
                            ) : (
                              <User className="w-5 h-5 text-accent" />
                            )}
                            <div>
                              <h3 className="font-medium">{getPartnerName(partnership)}</h3>
                              <p className="text-sm text-muted-foreground">
                                {getPartnerRole(partnership) === 'dominant' ? 'Dominant(e)' : 'Soumis(e)'}
                              </p>
                            </div>
                          </div>
                          {getPartnershipStatusBadge(partnership)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pending Requests */}
          <TabsContent value="pending">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <UserPlus className="w-5 h-5 text-primary" />
                  <span>Demandes en attente</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {partnerships?.filter(p => p.status === 'pending').length === 0 ? (
                  <div className="text-center py-8 space-y-2">
                    <UserPlus className="w-12 h-12 text-muted-foreground mx-auto" />
                    <p className="text-muted-foreground">Aucune demande en attente</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {partnerships?.filter(p => p.status === 'pending').map((partnership) => (
                      <div key={partnership.id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {getPartnerRole(partnership) === 'dominant' ? (
                              <Crown className="w-5 h-5 text-primary" />
                            ) : (
                              <User className="w-5 h-5 text-accent" />
                            )}
                            <div>
                              <h3 className="font-medium">{getPartnerName(partnership)}</h3>
                              <p className="text-sm text-muted-foreground">
                                {getPartnerRole(partnership) === 'dominant' ? 'Dominant(e)' : 'Soumis(e)'}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {partnership.dominant_id === user?.id 
                                  ? "Demande envoyée" 
                                  : "Demande reçue"
                                }
                              </p>
                            </div>
                          </div>
          <div className="flex items-center space-x-2">
            {getPartnershipStatusBadge(partnership)}
            {canRespondToPartnership(partnership) && (
              <div className="flex space-x-2">
                <Button 
                  size="sm"
                  onClick={() => updatePartnershipMutation.mutate({
                    partnershipId: partnership.id,
                    status: 'accepted'
                  })}
                  disabled={updatePartnershipMutation.isPending}
                >
                  <Check className="w-4 h-4" />
                </Button>
                <Button 
                  size="sm"
                  variant="destructive"
                  onClick={() => updatePartnershipMutation.mutate({
                    partnershipId: partnership.id,
                    status: 'rejected'
                  })}
                  disabled={updatePartnershipMutation.isPending}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            )}
            {partnership.status === 'accepted' && (
              <Button 
                size="sm"
                variant="outline"
                onClick={() => updatePartnershipMutation.mutate({
                  partnershipId: partnership.id,
                  status: 'dissolved'
                })}
                disabled={updatePartnershipMutation.isPending}
              >
                Dissoudre
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
          </TabsContent>

          {/* Partner Search */}
          <TabsContent value="search">
            <PartnerSearch userRole={profile?.role || 'submissive'} />
          </TabsContent>

          {/* Invite New Partners */}
          <TabsContent value="invite">
            <Card className="shadow-soft">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <UserPlus className="w-5 h-5 text-primary" />
                  <span>Inviter par liste</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {availableProfiles && availableProfiles.length > 0 ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      Sélectionnez {profile?.role === 'dominant' ? 'un(e) soumis(e)' : 'un(e) dominant(e)'} 
                      {' '}pour envoyer une demande de partenariat :
                    </p>
                    {availableProfiles.map((availableProfile) => (
                      <div key={availableProfile.user_id} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            {availableProfile.role === 'dominant' ? (
                              <Crown className="w-5 h-5 text-primary" />
                            ) : (
                              <User className="w-5 h-5 text-accent" />
                            )}
                            <div>
                              <h3 className="font-medium">{availableProfile.display_name}</h3>
                              <p className="text-sm text-muted-foreground">
                                {availableProfile.role === 'dominant' ? 'Dominant(e)' : 'Soumis(e)'}
                              </p>
                            </div>
                          </div>
                          <Button 
                            onClick={() => createPartnershipMutation.mutate(availableProfile.user_id)}
                            disabled={createPartnershipMutation.isPending}
                          >
                            <UserPlus className="w-4 h-4 mr-2" />
                            Inviter
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 space-y-2">
                    <UserPlus className="w-12 h-12 text-muted-foreground mx-auto" />
                    <p className="text-muted-foreground">
                      Aucun {profile?.role === 'dominant' ? 'soumis(e)' : 'dominant(e)'} disponible
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Tous les utilisateurs compatibles sont déjà connectés ou ont une demande en cours
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Partnership;