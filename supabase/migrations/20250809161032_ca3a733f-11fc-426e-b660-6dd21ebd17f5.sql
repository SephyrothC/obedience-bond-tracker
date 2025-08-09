-- Create reward_purchases table to track when users buy rewards
CREATE TABLE public.reward_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  reward_id UUID NOT NULL,
  user_id UUID NOT NULL,
  points_spent INTEGER NOT NULL,
  purchased_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'pending'
);

-- Enable RLS
ALTER TABLE public.reward_purchases ENABLE ROW LEVEL SECURITY;

-- Users can view their own purchases and their partners' purchases
CREATE POLICY "Users can view related reward purchases" 
ON public.reward_purchases 
FOR SELECT 
USING (
  auth.uid() = user_id OR 
  auth.uid() IN (
    SELECT rewards.created_by FROM rewards 
    WHERE rewards.id = reward_purchases.reward_id
  )
);

-- Users can create their own purchases
CREATE POLICY "Users can create their own reward purchases" 
ON public.reward_purchases 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Add updated_at trigger
CREATE TRIGGER update_reward_purchases_updated_at
BEFORE UPDATE ON public.reward_purchases
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();