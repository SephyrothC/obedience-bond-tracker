import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Check, X, Crown, User } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

const PartnershipNotifications = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: pendingRequests } = useQuery({
    queryKey: ['pendingPartnershipRequests', user?.id],
    queryFn: async () => {
      if (!user) return [];
      
      const { data, error } = await supabase
        .from('partnerships')
        .select(`
          *,
          dominant_profile:profiles!partnerships_dominant_id_fkey(display_name, role),
          submissive_profile:profiles!partnerships_submissive_id_fkey(display_name, role)
        `)
        .eq('submissive_id', user.id)
        .eq('status', 'pending');

      if (error) throw error;
      return data;
    },
    enabled: !!user
  });

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
      queryClient.invalidateQueries({ queryKey: ['pendingPartnershipRequests'] });
      queryClient.invalidateQueries({ queryKey: ['partnerships'] });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le partenariat.",
        variant: "destructive",
      });
    }
  });

  if (!pendingRequests || pendingRequests.length === 0) {
    return null;
  }

  return (
    <Card className="shadow-soft border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Bell className="w-5 h-5 text-primary" />
          <span>Nouvelles demandes de partenariat</span>
          <Badge variant="outline" className="ml-auto">
            {pendingRequests.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {pendingRequests.map((request) => (
            <div key={request.id} className="p-4 border rounded-lg bg-background">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Crown className="w-5 h-5 text-primary" />
                  <div>
                    <h3 className="font-medium">
                      {request.dominant_profile?.display_name}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Souhaite devenir votre Dominant(e)
                    </p>
                  </div>
                </div>
                <div className="flex space-x-2">
                  <Button 
                    size="sm"
                    onClick={() => updatePartnershipMutation.mutate({
                      partnershipId: request.id,
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
                      partnershipId: request.id,
                      status: 'rejected'
                    })}
                    disabled={updatePartnershipMutation.isPending}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default PartnershipNotifications;