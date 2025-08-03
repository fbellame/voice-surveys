-- Add user_id to survey_response table to link responses to authenticated users
ALTER TABLE public.survey_response 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Update survey_invitations to also track user_id when they respond
ALTER TABLE public.survey_invitations 
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Drop existing anonymous policies
DROP POLICY IF EXISTS "Allow anonymous read access to survey_response" ON public.survey_response;
DROP POLICY IF EXISTS "Allow anonymous insert access to survey_response" ON public.survey_response;
DROP POLICY IF EXISTS "Allow anonymous update access to survey_response" ON public.survey_response;
DROP POLICY IF EXISTS "Allow anonymous delete access to survey_response" ON public.survey_response;

DROP POLICY IF EXISTS "Allow anonymous read access to answer" ON public.answer;
DROP POLICY IF EXISTS "Allow anonymous insert access to answer" ON public.answer;
DROP POLICY IF EXISTS "Allow anonymous update access to answer" ON public.answer;
DROP POLICY IF EXISTS "Allow anonymous delete access to answer" ON public.answer;

DROP POLICY IF EXISTS "Allow anonymous read access to survey_invitations" ON public.survey_invitations;
DROP POLICY IF EXISTS "Allow anonymous insert access to survey_invitations" ON public.survey_invitations;
DROP POLICY IF EXISTS "Allow anonymous update access to survey_invitations" ON public.survey_invitations;
DROP POLICY IF EXISTS "Allow anonymous delete access to survey_invitations" ON public.survey_invitations;

-- Create user-specific RLS policies for survey_response
CREATE POLICY "Users can view their own survey responses" 
ON public.survey_response 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own survey responses" 
ON public.survey_response 
FOR INSERT 
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own survey responses" 
ON public.survey_response 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

-- Create user-specific RLS policies for answers
CREATE POLICY "Users can view their own answers" 
ON public.answer 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.survey_response 
    WHERE survey_response.id = answer.survey_response_id 
    AND survey_response.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create answers for their survey responses" 
ON public.answer 
FOR INSERT 
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.survey_response 
    WHERE survey_response.id = answer.survey_response_id 
    AND survey_response.user_id = auth.uid()
  )
);

-- Create user-specific RLS policies for survey_invitations
CREATE POLICY "Users can view their own invitations" 
ON public.survey_invitations 
FOR SELECT 
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own invitations" 
ON public.survey_invitations 
FOR UPDATE 
TO authenticated
USING (auth.uid() = user_id);

-- Allow anonymous access to survey_invitations for initial token validation
CREATE POLICY "Allow anonymous read for token validation" 
ON public.survey_invitations 
FOR SELECT 
TO anon
USING (true);

-- Keep campaigns publicly readable for survey access
-- (campaigns remain with anonymous access as they're public surveys)