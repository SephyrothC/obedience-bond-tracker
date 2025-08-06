-- Mettre à jour la politique RLS pour permettre la recherche de profils
-- Les utilisateurs peuvent voir les profils d'autres utilisateurs pour la recherche de partenaires
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Users can view all profiles for partner search" 
ON public.profiles 
FOR SELECT 
USING (true);

-- Garder la politique restrictive pour les modifications
CREATE POLICY "Users can update their own profile" 
ON public.profiles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);