import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Heart, User, Crown } from 'lucide-react';

const Auth = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [role, setRole] = useState<'dominant' | 'submissive'>('submissive');
  const [loading, setLoading] = useState(false);
  
  const { signUp, signIn, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    if (isSignUp) {
      await signUp(email, password, displayName, role);
    } else {
      await signIn(email, password);
    }

    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="absolute inset-0 gradient-passion opacity-10" />
      
      <Card className="w-full max-w-md relative backdrop-blur-sm border-primary/20 shadow-passion">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 gradient-passion rounded-full flex items-center justify-center">
            <Heart className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold gradient-passion bg-clip-text text-transparent">
            Obéissance
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {isSignUp ? 'Créez votre compte pour commencer' : 'Connectez-vous à votre espace intime'}
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="displayName">Nom d'affichage</Label>
                <Input
                  id="displayName"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  placeholder="Comment souhaitez-vous être appelé(e) ?"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="votre@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                minLength={6}
              />
            </div>

            {isSignUp && (
              <div className="space-y-3">
                <Label>Votre rôle</Label>
                <RadioGroup
                  value={role}
                  onValueChange={(value) => setRole(value as 'dominant' | 'submissive')}
                  className="space-y-2"
                >
                  <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                    <RadioGroupItem value="dominant" id="dominant" />
                    <Label htmlFor="dominant" className="flex items-center space-x-2 cursor-pointer flex-1">
                      <Crown className="w-4 h-4 text-primary" />
                      <div>
                        <div className="font-medium">Dominant(e)</div>
                        <div className="text-sm text-muted-foreground">Je guide et contrôle</div>
                      </div>
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-3 rounded-lg border border-border hover:bg-accent/50 transition-colors">
                    <RadioGroupItem value="submissive" id="submissive" />
                    <Label htmlFor="submissive" className="flex items-center space-x-2 cursor-pointer flex-1">
                      <User className="w-4 h-4 text-accent" />
                      <div>
                        <div className="font-medium">Soumis(e)</div>
                        <div className="text-sm text-muted-foreground">J'obéis et je sers</div>
                      </div>
                    </Label>
                  </div>
                </RadioGroup>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full gradient-passion hover:opacity-90 transition-opacity"
              disabled={loading}
            >
              {loading ? 'Chargement...' : (isSignUp ? "S'inscrire" : 'Se connecter')}
            </Button>
          </form>

          <div className="mt-6 text-center">
            <Button
              variant="link"
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-primary hover:text-primary/80"
            >
              {isSignUp 
                ? 'Déjà un compte ? Connectez-vous' 
                : "Pas encore de compte ? Inscrivez-vous"
              }
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;