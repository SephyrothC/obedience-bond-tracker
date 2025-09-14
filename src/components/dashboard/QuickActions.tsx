import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Target, Gift, Zap, Heart, Plus, BarChart3, Calendar, Users, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface QuickActionsProps {
  userRole: string;
}

const QuickActions = ({ userRole }: QuickActionsProps) => {
  const navigate = useNavigate();

  const actions = [
    {
      icon: Target,
      label: 'Habitudes',
      onClick: () => navigate('/habits'),
      description: userRole === 'dominant' ? 'Gérer les habitudes' : 'Voir mes tâches'
    },
    {
      icon: Gift,
      label: 'Récompenses',
      onClick: () => navigate('/rewards'),
      description: 'Échanger des points'
    },
    {
      icon: Zap,
      label: 'Punitions',
      onClick: () => navigate('/punishments'),
      description: userRole === 'dominant' ? 'Gérer les punitions' : 'Voir les sanctions'
    },
    {
      icon: Heart,
      label: 'Partenaire',
      onClick: () => navigate('/partnership'),
      description: 'Gérer votre lien'
    },
    {
      icon: Users,
      label: 'Tâches partagées',
      onClick: () => navigate('/shared-tasks'),
      description: 'Travaillez ensemble'
    }
  ];

  return (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle>Actions rapides</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {actions.map((action, index) => (
            <Button 
              key={index}
              variant="outline" 
              className="h-20 flex-col space-y-2"
              onClick={action.onClick}
            >
              <action.icon className="w-6 h-6" />
              <span className="text-sm">{action.label}</span>
            </Button>
          ))}
        </div>
        
        {userRole === 'dominant' && (
          <div className="mt-4 pt-4 border-t space-y-2">
            <Button 
              onClick={() => navigate('/habits/create')} 
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Créer une nouvelle habitude
            </Button>
            <div className="grid grid-cols-2 gap-2">
              <Button 
                onClick={() => navigate('/partner-stats')} 
                variant="outline"
                className="w-full"
              >
                <BarChart3 className="w-4 h-4 mr-2" />
                Statistiques
              </Button>
              <Button 
                onClick={() => navigate('/calendar')} 
                variant="outline"
                className="w-full"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Agenda
              </Button>
            </div>
            <Button 
              onClick={() => navigate('/manage-rewards')} 
              variant="outline"
              className="w-full"
            >
              <Settings className="w-4 h-4 mr-2" />
              Gérer les récompenses
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default QuickActions;
