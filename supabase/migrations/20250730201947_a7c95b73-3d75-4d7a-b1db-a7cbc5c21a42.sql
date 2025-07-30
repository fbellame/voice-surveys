-- Allow UPDATE operations on campaign table
CREATE POLICY "Allow anonymous update access to campaign" 
ON public.campaign 
FOR UPDATE 
USING (true);