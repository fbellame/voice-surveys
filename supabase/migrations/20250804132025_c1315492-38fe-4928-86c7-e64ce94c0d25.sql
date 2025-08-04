-- Allow anonymous read access to campaigns for survey purposes
CREATE POLICY "Allow anonymous read for survey campaigns" 
ON public.campaign 
FOR SELECT 
USING (true);