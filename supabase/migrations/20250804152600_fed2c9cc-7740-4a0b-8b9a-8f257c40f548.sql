-- Allow anonymous users to insert user profiles for survey participants
CREATE POLICY "Allow anonymous insert for survey participants" 
ON public.user_profiles 
FOR INSERT 
WITH CHECK (true);

-- Allow anonymous users to update user profiles for survey participants
CREATE POLICY "Allow anonymous update for survey participants" 
ON public.user_profiles 
FOR UPDATE 
USING (true);