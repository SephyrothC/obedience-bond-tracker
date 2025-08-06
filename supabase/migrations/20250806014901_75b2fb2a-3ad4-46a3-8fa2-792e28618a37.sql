-- Supprimer l'ancienne politique restrictive et ajouter la nouvelle pour permettre la recherche
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

-- Permettre à tous les utilisateurs authentifiés de voir les profils pour la recherche de partenaires
CREATE POLICY "Users can view all profiles for partner search" 
ON public.profiles 
FOR SELECT 
USING (true);