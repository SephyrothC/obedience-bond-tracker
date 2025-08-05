import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Heart, Users, Clock, CheckCircle } from 'lucide-react';

const PartnershipStats = () => {
  const { user } = useAuth();

  const { data: stats } = useQuery({
    queryKey: ['partnershipStats', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data: partnerships, error } = await supabase
        .from('partnerships')
        .select('status, created_at')
        .or(`dominant_id.eq.${user.id},submissive_id.eq.${user.id}`);

      if (error) throw error;

      const totalPartnerships = partnerships.length;
      const activePartnerships = partnerships.filter(p => p.status === 'accepted').length;
      const pendingPartnerships = partnerships.filter(p => p.status === 'pending').length;
      
      // Calculate average partnership duration for active ones
      const activePartnershipDurations = partnerships
        .filter(p => p.status === 'accepted')
        .map(p => {
          const created = new Date(p.created_at);
          const now = new Date();
          const diffTime = Math.abs(now.getTime() - created.getTime());
          return Math.ceil(diffTime / (1000 * 60 * 60 * 24)); // days
        });
      
      const averageDuration = activePartnershipDurations.length > 0
        ? Math.round(activePartnershipDurations.reduce((a, b) => a + b, 0) / activePartnershipDurations.length)
        : 0;

      return {
        total: totalPartnerships,
        active: activePartnerships,
        pending: pendingPartnerships,
        averageDurationDays: averageDuration
      };
    },
    enabled: !!user
  });

  if (!stats) return null;

  const statCards = [
    {
      title: "Partenariats actifs",
      value: stats.active,
      icon: Heart,
      color: "text-destructive",
      bgColor: "bg-destructive/5"
    },
    {
      title: "Total des liens",
      value: stats.total,
      icon: Users,
      color: "text-primary",
      bgColor: "bg-primary/5"
    },
    {
      title: "En attente",
      value: stats.pending,
      icon: Clock,
      color: "text-amber-600",
      bgColor: "bg-amber-500/5"
    },
    {
      title: "Durée moyenne",
      value: stats.averageDurationDays > 0 ? `${stats.averageDurationDays}j` : "-",
      icon: CheckCircle,
      color: "text-accent",
      bgColor: "bg-accent/5"
    }
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {statCards.map((stat) => (
        <Card key={stat.title} className="shadow-soft">
          <CardContent className="p-4">
            <div className={`w-10 h-10 rounded-lg ${stat.bgColor} flex items-center justify-center mb-3`}>
              <stat.icon className={`w-5 h-5 ${stat.color}`} />
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-muted-foreground">{stat.title}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};

export default PartnershipStats;