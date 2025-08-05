import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, Crown, User, UserPlus, MapPin, Calendar } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface PartnerSearchProps {
  userRole: string;
}

const PartnerSearch = ({ userRole }: PartnerSearchProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');

  const { data: availablePartners, isLoading } = useQuery({
    queryKey: ['partnerSearch', user?.id, userRole, searchTerm],
    queryFn: async () => {
      if (!user) return [];
      
      const targetRole = userRole === 'dominant' ? 'submissive' : 'dominant';
      
      let query = supabase
        .from('profiles')
        .select('user_id, display_name, role, avatar_url, created_at')
        .eq('role', targetRole)
        .neq('user_id', user.id);

      if (searchTerm.trim()) {
        query = query.ilike('display_name', `%${searchTerm}%`);
      }

      const { data: profiles, error: profilesError } = await query.limit(20);
      
      if (profilesError) throw profilesError;

      // Get existing partnerships to filter out connected users
      const { data: partnerships, error: partnershipsError } = await supabase
        .from('partnerships')
        .select('dominant_id, submissive_id, status')
        .or(`dominant_id.eq.${user.id},submissive_id.eq.${user.id}`)
        .in('status', ['pending', 'accepted']);

      if (partnershipsError) throw partnershipsError;

      const connectedUserIds = new Set(
        partnerships.map(p => 
          p.dominant_id === user.id ? p.submissive_id : p.dominant_id
        )
      );

      return profiles.filter(p => !connectedUserIds.has(p.user_id));
    },
    enabled: !!user
  });

  const createPartnershipMutation = useMutation({
    mutationFn: async (targetUserId: string) => {
      if (!user) throw new Error('User not authenticated');

      const partnershipData = userRole === 'dominant' 
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
      queryClient.invalidateQueries({ queryKey: ['partnerSearch'] });
      queryClient.invalidateQueries({ queryKey: ['partnerships'] });
    },
    onError: (error) => {
      toast({
        title: "Erreur",
        description: "Impossible d'envoyer la demande. Veuillez réessayer.",
        variant: "destructive",
      });
    }
  });

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const formatJoinDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { 
      year: 'numeric', 
      month: 'long' 
    });
  };

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Search className="w-5 h-5 text-primary" />
          <span>Rechercher des partenaires</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder={`Rechercher ${userRole === 'dominant' ? 'des soumis(es)' : 'des dominant(e)s'}...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Recherche en cours...</p>
          </div>
        ) : availablePartners && availablePartners.length > 0 ? (
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {availablePartners.map((partner) => (
              <div key={partner.user_id} className="p-4 border rounded-lg hover:bg-accent/5 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-10 h-10">
                      <AvatarImage src={partner.avatar_url} />
                      <AvatarFallback className="bg-primary/10 text-primary">
                        {getInitials(partner.display_name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <h3 className="font-medium truncate">{partner.display_name}</h3>
                        {partner.role === 'dominant' ? (
                          <Crown className="w-4 h-4 text-primary flex-shrink-0" />
                        ) : (
                          <User className="w-4 h-4 text-accent flex-shrink-0" />
                        )}
                      </div>
                      <div className="flex items-center space-x-4 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {partner.role === 'dominant' ? 'Dominant(e)' : 'Soumis(e)'}
                        </Badge>
                        <div className="flex items-center space-x-1 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3" />
                          <span>Membre depuis {formatJoinDate(partner.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <Button 
                    size="sm"
                    onClick={() => createPartnershipMutation.mutate(partner.user_id)}
                    disabled={createPartnershipMutation.isPending}
                    className="flex-shrink-0"
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
            <Search className="w-12 h-12 text-muted-foreground mx-auto" />
            <p className="text-muted-foreground">
              {searchTerm ? 'Aucun résultat trouvé' : `Aucun ${userRole === 'dominant' ? 'soumis(e)' : 'dominant(e)'} disponible`}
            </p>
            <p className="text-sm text-muted-foreground">
              {searchTerm 
                ? 'Essayez avec un autre terme de recherche' 
                : 'Revenez plus tard pour voir de nouveaux membres'
              }
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PartnerSearch;