-- Recréer la vue sans security_invoker pour éviter le problème de sécurité
DROP VIEW IF EXISTS public.partner_stats;

-- Les maîtres peuvent maintenant accéder aux données de leurs partenaires via les politiques RLS modifiées
-- Pas besoin de vue spéciale, les requêtes directes sur les tables fonctionneront