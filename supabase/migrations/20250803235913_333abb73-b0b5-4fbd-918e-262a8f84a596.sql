-- Fix RLS policies for answer table to allow viewing answers for all survey responses
-- regardless of user authentication status

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Users can view their own answers" ON public.answer;
DROP POLICY IF EXISTS "Users can create answers for their survey responses" ON public.answer;

-- Create new policies that allow broader access
CREATE POLICY "Allow anonymous read access to answers" 
ON public.answer 
FOR SELECT 
USING (true);

CREATE POLICY "Allow anonymous insert access to answers" 
ON public.answer 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow anonymous update access to answers" 
ON public.answer 
FOR UPDATE 
USING (true);