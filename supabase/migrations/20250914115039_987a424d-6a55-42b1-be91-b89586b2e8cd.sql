-- Add status tracking for punishments and rewards
ALTER TABLE public.punishments 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'available' CHECK (status IN ('available', 'assigned', 'completed'));

ALTER TABLE public.reward_purchases 
ADD COLUMN IF NOT EXISTS validated_by UUID,
ADD COLUMN IF NOT EXISTS validated_at TIMESTAMP WITH TIME ZONE;

-- Create punishment assignments table
CREATE TABLE IF NOT EXISTS public.punishment_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  punishment_id UUID NOT NULL REFERENCES public.punishments(id) ON DELETE CASCADE,
  assigned_to UUID NOT NULL,
  assigned_by UUID NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned', 'completed', 'validated')),
  notes TEXT,
  completed_at TIMESTAMP WITH TIME ZONE,
  validated_by UUID,
  validated_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS on punishment_assignments
ALTER TABLE public.punishment_assignments ENABLE ROW LEVEL SECURITY;

-- Policies for punishment_assignments
CREATE POLICY "Users can view their punishment assignments" 
ON public.punishment_assignments 
FOR SELECT 
USING (
  auth.uid() = assigned_to OR 
  auth.uid() = assigned_by OR
  auth.uid() IN (
    SELECT partnerships.dominant_id FROM partnerships 
    WHERE partnerships.submissive_id = assigned_to AND partnerships.status = 'accepted'
  )
);

CREATE POLICY "Dominants can create punishment assignments" 
ON public.punishment_assignments 
FOR INSERT 
WITH CHECK (
  auth.uid() = assigned_by AND
  auth.uid() IN (
    SELECT partnerships.dominant_id FROM partnerships 
    WHERE partnerships.submissive_id = assigned_to AND partnerships.status = 'accepted'
  )
);

CREATE POLICY "Users can update their punishment assignments" 
ON public.punishment_assignments 
FOR UPDATE 
USING (
  auth.uid() = assigned_to OR 
  (auth.uid() = assigned_by AND status != 'completed')
);

-- Update existing policies for rewards to allow both partners to purchase
DROP POLICY IF EXISTS "Users can create their own reward purchases" ON public.reward_purchases;

CREATE POLICY "Partners can create reward purchases" 
ON public.reward_purchases 
FOR INSERT 
WITH CHECK (
  auth.uid() = user_id OR
  auth.uid() IN (
    SELECT partnerships.dominant_id FROM partnerships 
    WHERE partnerships.submissive_id = user_id AND partnerships.status = 'accepted'
  ) OR
  auth.uid() IN (
    SELECT partnerships.submissive_id FROM partnerships 
    WHERE partnerships.dominant_id = user_id AND partnerships.status = 'accepted'
  )
);

-- Update RLS for reward purchases to allow validation
DROP POLICY IF EXISTS "Dominants can update reward purchase status" ON public.reward_purchases;

CREATE POLICY "Partners can update reward purchases" 
ON public.reward_purchases 
FOR UPDATE 
USING (
  auth.uid() = user_id OR
  auth.uid() IN (
    SELECT partnerships.dominant_id FROM partnerships 
    WHERE partnerships.submissive_id = user_id AND partnerships.status = 'accepted'
  ) OR
  auth.uid() IN (
    SELECT partnerships.submissive_id FROM partnerships 
    WHERE partnerships.dominant_id = user_id AND partnerships.status = 'accepted'
  ) OR
  auth.uid() IN (
    SELECT rewards.created_by FROM rewards 
    WHERE rewards.id = reward_purchases.reward_id
  )
);

-- Update rewards policies to only allow dominants to create
DROP POLICY IF EXISTS "Creators can manage rewards" ON public.rewards;

CREATE POLICY "Dominants can create rewards" 
ON public.rewards 
FOR INSERT 
WITH CHECK (
  auth.uid() = created_by AND
  (
    auth.uid() = for_user OR
    auth.uid() IN (
      SELECT partnerships.dominant_id FROM partnerships 
      WHERE partnerships.submissive_id = for_user AND partnerships.status = 'accepted'
    )
  )
);

CREATE POLICY "Creators can manage their rewards" 
ON public.rewards 
FOR ALL
USING (auth.uid() = created_by);

-- Update punishments policies to only allow dominants to create
DROP POLICY IF EXISTS "Users can create punishments" ON public.punishments;

CREATE POLICY "Dominants can create punishments" 
ON public.punishments 
FOR INSERT 
WITH CHECK (
  auth.uid() = created_by AND
  (
    auth.uid() = for_user OR
    auth.uid() IN (
      SELECT partnerships.dominant_id FROM partnerships 
      WHERE partnerships.submissive_id = for_user AND partnerships.status = 'accepted'
    )
  )
);

-- Add trigger for punishment_assignments timestamps
CREATE TRIGGER update_punishment_assignments_updated_at
BEFORE UPDATE ON public.punishment_assignments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();