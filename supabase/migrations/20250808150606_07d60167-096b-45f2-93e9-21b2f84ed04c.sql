-- Create shared_tasks table for tasks that both partners can work on together
CREATE TABLE public.shared_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  partnership_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  points_value INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  due_date TIMESTAMP WITH TIME ZONE,
  completion_target INTEGER DEFAULT 1,
  current_progress INTEGER DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.shared_tasks ENABLE ROW LEVEL SECURITY;

-- Create policies for shared tasks
CREATE POLICY "Partners can view their shared tasks" 
ON public.shared_tasks 
FOR SELECT 
USING (partnership_id IN (
  SELECT id FROM partnerships 
  WHERE (dominant_id = auth.uid() OR submissive_id = auth.uid()) 
  AND status = 'accepted'
));

CREATE POLICY "Partners can create shared tasks" 
ON public.shared_tasks 
FOR INSERT 
WITH CHECK (
  created_by = auth.uid() AND 
  partnership_id IN (
    SELECT id FROM partnerships 
    WHERE (dominant_id = auth.uid() OR submissive_id = auth.uid()) 
    AND status = 'accepted'
  )
);

CREATE POLICY "Partners can update their shared tasks" 
ON public.shared_tasks 
FOR UPDATE 
USING (partnership_id IN (
  SELECT id FROM partnerships 
  WHERE (dominant_id = auth.uid() OR submissive_id = auth.uid()) 
  AND status = 'accepted'
));

CREATE POLICY "Creators can delete shared tasks" 
ON public.shared_tasks 
FOR DELETE 
USING (created_by = auth.uid());

-- Create shared_task_contributions table to track who contributed to each task
CREATE TABLE public.shared_task_contributions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  shared_task_id UUID NOT NULL REFERENCES public.shared_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  contribution_amount INTEGER NOT NULL DEFAULT 1,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.shared_task_contributions ENABLE ROW LEVEL SECURITY;

-- Create policies for contributions
CREATE POLICY "Partners can view task contributions" 
ON public.shared_task_contributions 
FOR SELECT 
USING (shared_task_id IN (
  SELECT id FROM shared_tasks 
  WHERE partnership_id IN (
    SELECT id FROM partnerships 
    WHERE (dominant_id = auth.uid() OR submissive_id = auth.uid()) 
    AND status = 'accepted'
  )
));

CREATE POLICY "Partners can add contributions" 
ON public.shared_task_contributions 
FOR INSERT 
WITH CHECK (
  user_id = auth.uid() AND 
  shared_task_id IN (
    SELECT id FROM shared_tasks 
    WHERE partnership_id IN (
      SELECT id FROM partnerships 
      WHERE (dominant_id = auth.uid() OR submissive_id = auth.uid()) 
      AND status = 'accepted'
    )
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_shared_tasks_updated_at
BEFORE UPDATE ON public.shared_tasks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();