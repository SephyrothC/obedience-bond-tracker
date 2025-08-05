-- Add additional profile fields for better partner matching
ALTER TABLE public.profiles 
ADD COLUMN bio TEXT,
ADD COLUMN age INTEGER,
ADD COLUMN location TEXT,
ADD COLUMN interests TEXT[],
ADD COLUMN looking_for TEXT,
ADD COLUMN experience_level TEXT DEFAULT 'beginner',
ADD COLUMN availability TEXT DEFAULT 'flexible';

-- Create index for better search performance
CREATE INDEX idx_profiles_display_name ON public.profiles USING gin(to_tsvector('french', display_name));
CREATE INDEX idx_profiles_bio ON public.profiles USING gin(to_tsvector('french', bio));
CREATE INDEX idx_profiles_interests ON public.profiles USING gin(interests);

-- Add partnership history tracking
CREATE TABLE public.partnership_interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partnership_id UUID NOT NULL REFERENCES public.partnerships(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS on partnership_interactions
ALTER TABLE public.partnership_interactions ENABLE ROW LEVEL SECURITY;

-- Create policies for partnership_interactions
CREATE POLICY "Users can view their partnership interactions" 
ON public.partnership_interactions 
FOR SELECT 
USING (
  partnership_id IN (
    SELECT id FROM public.partnerships 
    WHERE dominant_id = auth.uid() OR submissive_id = auth.uid()
  )
);

CREATE POLICY "Users can create interactions for their partnerships" 
ON public.partnership_interactions 
FOR INSERT 
WITH CHECK (
  created_by = auth.uid() AND
  partnership_id IN (
    SELECT id FROM public.partnerships 
    WHERE (dominant_id = auth.uid() OR submissive_id = auth.uid()) 
    AND status = 'accepted'
  )
);

-- Add trigger for updated_at on partnership_interactions
CREATE TRIGGER update_partnership_interactions_updated_at
  BEFORE UPDATE ON public.partnership_interactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();