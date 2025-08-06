-- Modifier la politique pour permettre aux dominants de voir les transactions de points de leurs partenaires
DROP POLICY IF EXISTS "Users can view their transactions" ON public.points_transactions;

CREATE POLICY "Users can view their transactions and their partners' transactions" 
ON public.points_transactions 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR auth.uid() = created_by 
  OR auth.uid() IN (
    SELECT dominant_id 
    FROM partnerships 
    WHERE submissive_id = points_transactions.user_id 
    AND status = 'accepted'
  )
);

-- Modifier la politique pour permettre aux dominants de voir les complétions d'habitudes de leurs partenaires
DROP POLICY IF EXISTS "Users can view related completions" ON public.habit_completions;

CREATE POLICY "Users can view related completions and their partners' completions" 
ON public.habit_completions 
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR auth.uid() IN (
    SELECT habits.created_by
    FROM habits
    WHERE habits.id = habit_completions.habit_id
  )
  OR auth.uid() IN (
    SELECT dominant_id 
    FROM partnerships 
    WHERE submissive_id = habit_completions.user_id 
    AND status = 'accepted'
  )
);

-- Créer une vue pour faciliter l'accès aux stats des partenaires
CREATE OR REPLACE VIEW public.partner_stats AS
SELECT 
  p.user_id,
  p.display_name,
  p.role,
  COALESCE(SUM(CASE WHEN pt.type = 'earned' THEN pt.points ELSE 0 END), 0) as total_points_earned,
  COALESCE(SUM(CASE WHEN pt.type = 'spent' THEN pt.points ELSE 0 END), 0) as total_points_spent,
  COALESCE(SUM(CASE WHEN pt.type = 'earned' THEN pt.points ELSE -pt.points END), 0) as current_points,
  COUNT(DISTINCT hc.id) as total_completions,
  COUNT(DISTINCT CASE WHEN DATE(hc.completed_at) = CURRENT_DATE THEN hc.id END) as completions_today,
  COUNT(DISTINCT h.id) as total_habits_assigned
FROM profiles p
LEFT JOIN points_transactions pt ON p.user_id = pt.user_id
LEFT JOIN habit_completions hc ON p.user_id = hc.user_id
LEFT JOIN habits h ON p.user_id = h.assigned_to
GROUP BY p.user_id, p.display_name, p.role;

-- Ajouter une politique RLS pour la vue
ALTER VIEW public.partner_stats SET (security_invoker = true);

-- Créer une politique pour la vue
CREATE POLICY "Users can view their own stats and their partners' stats" 
ON public.partner_stats
FOR SELECT 
USING (
  auth.uid() = user_id 
  OR auth.uid() IN (
    SELECT dominant_id 
    FROM partnerships 
    WHERE submissive_id = partner_stats.user_id 
    AND status = 'accepted'
  )
);