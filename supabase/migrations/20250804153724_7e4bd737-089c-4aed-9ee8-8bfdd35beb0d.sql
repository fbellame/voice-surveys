-- Fix the RLS policies for user_profiles to properly allow survey participants

-- Drop the problematic policies
DROP POLICY "Allow survey participants to create profiles" ON public.user_profiles;
DROP POLICY "Allow survey participants to update profiles" ON public.user_profiles;

-- Create simple, effective policies for anonymous survey participants
-- Allow anonymous users to create profiles (for survey participation)
CREATE POLICY "Allow anonymous users to create profiles for surveys" 
ON public.user_profiles 
FOR INSERT 
WITH CHECK (auth.uid() IS NULL);

-- Allow anonymous users to update any profile (since they can only access during survey session)
CREATE POLICY "Allow anonymous users to update profiles for surveys" 
ON public.user_profiles 
FOR UPDATE 
USING (auth.uid() IS NULL);