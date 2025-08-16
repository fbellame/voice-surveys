import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const url = new URL(req.url)
    const path = url.pathname

    // Get campaign details
    if (path.startsWith('/campaigns/') && path.includes('/details') && req.method === 'GET') {
      const campaignUri = path.split('/')[2]
      const token = url.searchParams.get('token')
      
      if (!token) {
        return new Response(
          JSON.stringify({ error: 'Token is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get campaign by URI
      const { data: campaign, error: campaignError } = await supabaseClient
        .from('campaign')
        .select('id, name, description, intro_prompt, purpose_explanation, greeting, closing')
        .eq('campaign_uri', campaignUri)
        .single()

      if (campaignError || !campaign) {
        return new Response(
          JSON.stringify({ error: 'Campaign not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Verify link token
      const { data: link, error: linkError } = await supabaseClient
        .from('campaign_links')
        .select('id, is_active, is_anonymous, max_responses, current_responses')
        .eq('unique_token', token)
        .eq('campaign_id', campaign.id)
        .single()

      if (linkError || !link) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired link' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!link.is_active) {
        return new Response(
          JSON.stringify({ error: 'Survey link is no longer active' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Get questions
      const { data: questions, error: questionsError } = await supabaseClient
        .from('question')
        .select('id, question_text, question_order')
        .eq('campaign_id', campaign.id)
        .order('question_order')

      if (questionsError) {
        return new Response(
          JSON.stringify({ error: 'Failed to fetch questions' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({
          campaign,
          link: {
            is_anonymous: link.is_anonymous,
            max_responses: link.max_responses,
            current_responses: link.current_responses
          },
          questions
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create submission
    if (path === '/submissions' && req.method === 'POST') {
      const body = await req.json()
      const { campaign_id, link_token, link_type, room_name, s3_recording_url, call_timestamp } = body

      if (!campaign_id || !link_token || !link_type) {
        return new Response(
          JSON.stringify({ error: 'Missing required fields' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // Verify link
      const { data: link, error: linkError } = await supabaseClient
        .from('campaign_links')
        .select('id, is_active, is_anonymous, max_responses, current_responses')
        .eq('unique_token', link_token)
        .eq('campaign_id', campaign_id)
        .eq('link_type', link_type)
        .single()

      if (linkError || !link) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired survey link' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (!link.is_active) {
        return new Response(
          JSON.stringify({ error: 'This survey link is no longer active' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      if (link.max_responses && link.current_responses >= link.max_responses) {
        return new Response(
          JSON.stringify({ error: 'Maximum number of responses reached for this survey' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      let user_profile_id = null

      // Handle user profile creation based on link type and anonymous setting
      if (link_type === 'personal') {
        // Personal links always create user profiles
        const { data: userProfile, error: profileError } = await supabaseClient
          .from('user_profiles')
          .insert({
            campaign_id,
            link_token,
            link_type,
            // Add user profile data if provided in body
            ...(body.user_profile_data || {})
          })
          .select('id')
          .single()

        if (profileError) {
          return new Response(
            JSON.stringify({ error: 'Failed to create user profile' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        user_profile_id = userProfile.id
      } else if (link_type === 'generic' && !link.is_anonymous) {
        // Non-anonymous generic links create user profiles
        const { data: userProfile, error: profileError } = await supabaseClient
          .from('user_profiles')
          .insert({
            campaign_id,
            link_token,
            link_type,
          })
          .select('id')
          .single()

        if (profileError) {
          return new Response(
            JSON.stringify({ error: 'Failed to create user profile' }),
            { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }

        user_profile_id = userProfile.id
      }
      // For anonymous generic links, no user profile is created

      // Create the survey submission
      const { data: submission, error: submissionError } = await supabaseClient
        .from('survey_submissions')
        .insert({
          campaign_id,
          user_profile_id,
          room_name,
          link_token,
          link_type,
          s3_recording_url,
          call_timestamp
        })
        .select('id')
        .single()

      if (submissionError) {
        return new Response(
          JSON.stringify({ error: 'Failed to create survey submission' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({
          submission_id: submission.id,
          user_profile_id,
          is_anonymous: !user_profile_id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Submit answers
    if (path.startsWith('/submissions/') && path.includes('/answers') && req.method === 'POST') {
      const submissionId = path.split('/')[2]
      const body = await req.json()
      const { answers } = body

      if (!answers || !Array.isArray(answers) || answers.length === 0) {
        return new Response(
          JSON.stringify({ error: 'No answers provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const answersToInsert = answers.map((answer: any) => ({
        survey_submission_id: submissionId,
        question_id: answer.question_id,
        answer_text: answer.answer_text
      }))

      const { error } = await supabaseClient
        .from('answer')
        .insert(answersToInsert)

      if (error) {
        return new Response(
          JSON.stringify({ error: 'Failed to submit answers' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ success: true, answers_submitted: answers.length }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ error: 'Endpoint not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
