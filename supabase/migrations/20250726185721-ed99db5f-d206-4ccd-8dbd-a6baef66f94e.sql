-- Create campaign table
CREATE TABLE public.campaign (
  id                   bigserial primary key,
  name                 text        not null,
  description          text,
  start_date           date,
  end_date             date,
  intro_prompt         text,
  purpose_explanation  text,
  greeting             text,
  closing              text,
  created_at           timestamptz default now()
);

-- Create question table
CREATE TABLE public.question (
  id            bigserial primary key,
  campaign_id   bigint     not null references public.campaign(id) on delete cascade,
  question_text text       not null,
  question_order int       not null,
  created_at    timestamptz default now()
);

-- Create call table
CREATE TABLE public.call (
  id              bigserial primary key,
  phone_number    text       not null,
  campaign_id     bigint     not null references public.campaign(id) on delete cascade,
  call_timestamp  timestamptz default now(),
  s3_recording_url text,
  unique (phone_number, campaign_id, call_timestamp)
);

-- Create answer table
CREATE TABLE public.answer (
  id           bigserial primary key,
  call_id      bigint not null references public.call(id) on delete cascade,
  question_id  bigint not null references public.question(id) on delete cascade,
  answer_text  text   not null,
  answered_at  timestamptz default now(),
  unique (call_id, question_id)
);

-- Enable Row Level Security
ALTER TABLE public.campaign ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.answer ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for authenticated users
CREATE POLICY "Authenticated users can view campaigns" 
ON public.campaign FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert campaigns" 
ON public.campaign FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update campaigns" 
ON public.campaign FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can delete campaigns" 
ON public.campaign FOR DELETE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can view questions" 
ON public.question FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert questions" 
ON public.question FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update questions" 
ON public.question FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can delete questions" 
ON public.question FOR DELETE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can view calls" 
ON public.call FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert calls" 
ON public.call FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update calls" 
ON public.call FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can delete calls" 
ON public.call FOR DELETE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can view answers" 
ON public.answer FOR SELECT 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can insert answers" 
ON public.answer FOR INSERT 
TO authenticated 
WITH CHECK (true);

CREATE POLICY "Authenticated users can update answers" 
ON public.answer FOR UPDATE 
TO authenticated 
USING (true);

CREATE POLICY "Authenticated users can delete answers" 
ON public.answer FOR DELETE 
TO authenticated 
USING (true);

-- Insert seed data
INSERT INTO public.campaign
  (id,name,description,intro_prompt,purpose_explanation,greeting,closing)
VALUES
  (1,'InnoVet-AMR 2024',
   'Survey on climate change, AMR, and animal health.',
   'You are the automated survey agent for the InnoVet-AMR initiative.',
   'Thank you for taking part in our InnoVet-AMR survey.',
   'Hello, welcome to our survey.',
   'Thank you for completing this survey. We value your input.');

INSERT INTO public.question
  (id,campaign_id,question_text,question_order)
VALUES
  (1,1,'What are your top three trends that are driving change in this space?',1),
  (2,1,'What are some of the biggest challenges and issues you are experiencing?',2),
  (3,1,'What new opportunities do you see to leverage innovation?',3);

INSERT INTO public.call
  (id,phone_number,campaign_id,call_timestamp,s3_recording_url)
VALUES
  (1,'+15145859691',1,'2025-07-26T17:20:47Z',null),
  (2,'+15145859691',1,'2025-07-26T17:27:15Z',null),
  (3,'+15145859691',1,'2025-07-26T17:39:40Z',
   's3://s3-photo-ai-saas/future_survey/20250726_133939_15145859691_call-_+15145859691_NCx7Lbnwwh5o.mp4');

INSERT INTO public.answer
  (id,call_id,question_id,answer_text,answered_at)
VALUES
  (1,1,1,'Wildfire, ice melting in Antarctica, destruction of community forest in Amazonia.','2025-07-26T17:21:59Z'),
  (2,1,2,'Quality of care in Montreal, heatwave in summer, quality of water in Montreal.','2025-07-26T17:21:59Z'),
  (3,1,3,'Use AI to better understand changes and tackle problems; modify government policy to account for those changes.','2025-07-26T17:21:59Z'),
  (4,2,1,'Canadian wildfire, Arctic ice meltdown, Amazonian forest destruction.','2025-07-26T17:28:32Z'),
  (5,2,2,'Air‑quality issues in Montreal summers and overall water quality.','2025-07-26T17:28:32Z'),
  (6,2,3,'Apply AI to analyse change and adjust policy accordingly.','2025-07-26T17:28:32Z'),
  (7,3,1,'Antarctic ice loss, Canadian wildfires, Amazon deforestation.','2025-07-26T17:41:39Z'),
  (8,3,2,'Montreal air‑quality and water‑quality concerns.','2025-07-26T17:41:39Z'),
  (9,3,3,'Leverage AI for insight and policy change.','2025-07-26T17:41:39Z');