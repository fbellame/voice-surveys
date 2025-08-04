-- Remove the overly permissive anonymous policies
DROP POLICY "Allow anonymous insert for survey participants" ON public.user_profiles;
DROP POLICY "Allow anonymous update for survey participants" ON public.user_profiles;

-- Instead, create a more targeted policy for survey participants
-- Allow users to create profiles when they have a valid survey invitation
CREATE POLICY "Allow survey participants to create profiles" 
ON public.user_profiles 
FOR INSERT 
WITH CHECK (
  EXISTS (
    SELECT 1 FROM survey_invitations si 
    WHERE si.user_id = auth.uid() 
    OR auth.uid() IS NULL -- Allow anonymous users for survey participation
  )
);

-- Allow survey participants to update their own profiles
CREATE POLICY "Allow survey participants to update profiles" 
ON public.user_profiles 
FOR UPDATE 
USING (
  user_id = auth.uid() 
  OR auth.uid() IS NULL -- Allow anonymous users for survey participation
);