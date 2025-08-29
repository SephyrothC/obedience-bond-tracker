import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Settings } from 'lucide-react';

const ManageRewards = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen p-4 md:p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4" />
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
        
        <Card className="shadow-soft">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Settings className="w-5 h-5" />
              <span>Page en construction</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Cette page permettra bientôt de gérer les demandes de récompenses.
            </p>
            <Button 
              onClick={() => navigate('/rewards')} 
              className="mt-4"
            >
              Retour aux récompenses
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ManageRewards;
