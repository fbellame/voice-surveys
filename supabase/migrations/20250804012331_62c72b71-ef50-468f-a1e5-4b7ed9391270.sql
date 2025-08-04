-- Add user_id column to campaign table
ALTER TABLE public.campaign 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update existing campaigns to have a user_id (set to null for now)
-- Note: You'll need to manually assign existing campaigns to users if needed

-- Drop the overly permissive anonymous policies
DROP POLICY IF EXISTS "Allow anonymous read access to campaign" ON public.campaign;
DROP POLICY IF EXISTS "Allow anonymous insert access to campaign" ON public.campaign;
DROP POLICY IF EXISTS "Allow anonymous update access to campaign" ON public.campaign;
DROP POLICY IF EXISTS "Allow anonymous delete access to campaign" ON public.campaign;

-- Create user-specific RLS policies
CREATE POLICY "Users can view their own campaigns" 
ON public.campaign 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own campaigns" 
ON public.campaign 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own campaigns" 
ON public.campaign 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own campaigns" 
ON public.campaign 
FOR DELETE 
USING (auth.uid() = user_id);