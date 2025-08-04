import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Zap, Target, Heart } from 'lucide-react';

interface StatsCardsProps {
  pointsBalance: number;
  completedHabits: number;
  totalHabits: number;
}

const StatsCards = ({ pointsBalance, completedHabits, totalHabits }: StatsCardsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card className="shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Points totaux</CardTitle>
          <Zap className="h-4 w-4 text-accent" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-accent">{pointsBalance || 0}</div>
          <p className="text-xs text-muted-foreground">
            Votre dévotion récompensée
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Habitudes du jour</CardTitle>
          <Target className="h-4 w-4 text-primary" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {completedHabits}/{totalHabits}
          </div>
          <p className="text-xs text-muted-foreground">
            Tâches accomplies aujourd'hui
          </p>
        </CardContent>
      </Card>

      <Card className="shadow-soft">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Connexion</CardTitle>
          <Heart className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">Active</div>
          <p className="text-xs text-muted-foreground">
            Votre lien est établi
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default StatsCards;