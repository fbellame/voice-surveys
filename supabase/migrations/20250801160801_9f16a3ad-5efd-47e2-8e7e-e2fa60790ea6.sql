-- Add DELETE policies for all tables to allow campaign deletion

-- Allow anonymous delete access to campaign
CREATE POLICY "Allow anonymous delete access to campaign" 
ON public.campaign 
FOR DELETE 
USING (true);

-- Allow anonymous delete access to campaign_room_mapping
CREATE POLICY "Allow anonymous delete access to campaign_room_mapping" 
ON public.campaign_room_mapping 
FOR DELETE 
USING (true);

-- Allow anonymous delete access to question
CREATE POLICY "Allow anonymous delete access to question" 
ON public.question 
FOR DELETE 
USING (true);

-- Allow anonymous delete access to survey_response
CREATE POLICY "Allow anonymous delete access to survey_response" 
ON public.survey_response 
FOR DELETE 
USING (true);

-- Allow anonymous delete access to answer
CREATE POLICY "Allow anonymous delete access to answer" 
ON public.answer 
FOR DELETE 
USING (true);