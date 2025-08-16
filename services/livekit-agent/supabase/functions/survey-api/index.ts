import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS'
};

Deno.serve(async (req)=>{
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }
  
  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '');
    const url = new URL(req.url);
    const fullPath = url.pathname;
    // Supabase strips the /functions/v1/ prefix, so we need to remove /survey-api
    const path = fullPath.replace('/survey-api', '');
    const method = req.method;
    
    console.log(`Survey API: ${method} ${fullPath} -> ${path}`);
    
    // Debug endpoint
    if ((method === 'GET' || method === 'POST') && (path === '' || path === '/')) {
      return new Response(JSON.stringify({
        message: 'Survey API is working',
        method,
        fullPath,
        path,
        searchParams: Object.fromEntries(url.searchParams),
        timestamp: new Date().toISOString()
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    // GET /campaigns/{campaign_uri}/details?token={link_token}
    if (method === 'GET' && path.match(/^\/campaigns\/([^\/]+)\/details$/)) {
      const match = path.match(/^\/campaigns\/([^\/]+)\/details$/);
      const campaignUri = match?.[1];
      const token = url.searchParams.get('token');
      
      if (!campaignUri) {
        return new Response(JSON.stringify({
          error: 'Campaign URI is required'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      
      // Get campaign
      const { data: campaign, error: campaignError } = await supabase
        .from('campaign')
        .select('*')
        .eq('campaign_uri', campaignUri)
        .single();
      
      if (campaignError || !campaign) {
        return new Response(JSON.stringify({
          error: 'Campaign not found'
        }), {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      
      // Get questions
      const { data: questions } = await supabase
        .from('question')
        .select('*')
        .eq('campaign_id', campaign.id)
        .order('question_order');
      
      let linkInfo = null;
      if (token) {
        // Try to find personal invitation first
        const { data: invitation } = await supabase
          .from('survey_invitations')
          .select('*')
          .eq('unique_token', token)
          .eq('campaign_id', campaign.id)
          .maybeSingle();
        
        if (invitation) {
          linkInfo = {
            id: invitation.id,
            unique_token: invitation.unique_token,
            link_type: 'personal',
            is_anonymous: false,
            is_active: !invitation.responded_at
          };
        } else {
          // Try to find campaign link
          const { data: campaignLink } = await supabase
            .from('campaign_links')
            .select('*')
            .eq('unique_token', token)
            .eq('campaign_id', campaign.id)
            .eq('is_active', true)
            .maybeSingle();
          
          if (campaignLink) {
            linkInfo = {
              id: campaignLink.id,
              unique_token: campaignLink.unique_token,
              link_type: 'generic',
              is_anonymous: campaignLink.is_anonymous,
              is_active: campaignLink.is_active
            };
          }
        }
        
        if (!linkInfo) {
          return new Response(JSON.stringify({
            error: 'Invalid or expired token'
          }), {
            status: 401,
            headers: {
              ...corsHeaders,
              'Content-Type': 'application/json'
            }
          });
        }
      }
      
      const response = {
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        campaign_uri: campaign.campaign_uri,
        intro_prompt: campaign.intro_prompt,
        purpose_explanation: campaign.purpose_explanation,
        greeting: campaign.greeting,
        closing: campaign.closing,
        is_active: campaign.is_active,
        questions: questions || [],
        link_info: linkInfo
      };
      
      return new Response(JSON.stringify(response), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    // GET /submissions?room_name={room_name}
    if (method === 'GET' && (path === '/submissions' || path === '/api/submissions')) {
      const roomName = url.searchParams.get('room_name');
      if (!roomName) {
        return new Response(JSON.stringify({
          error: 'room_name parameter is required'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      
      const { data: submissions, error } = await supabase
        .from('survey_submissions')
        .select('*')
        .eq('room_name', roomName);
      
      if (error) {
        return new Response(JSON.stringify({
          error: 'Failed to get submissions'
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      
      return new Response(JSON.stringify({
        submissions: submissions || []
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    // POST /submissions
    if (method === 'POST' && (path === '/submissions' || path === '/api/submissions')) {
      const body = await req.json();
      const { campaign_id, link_token, link_type, room_name, s3_recording_url, call_timestamp } = body;
      
      if (!campaign_id || !link_token || !link_type) {
        return new Response(JSON.stringify({
          error: 'Missing required fields: campaign_id, link_token, link_type'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      
      // Validate token exists
      let tokenValid = false;
      if (link_type === 'personal') {
        const { data: invitation } = await supabase
          .from('survey_invitations')
          .select('id')
          .eq('unique_token', link_token)
          .eq('campaign_id', campaign_id)
          .maybeSingle();
        tokenValid = !!invitation;
      } else {
        const { data: campaignLink } = await supabase
          .from('campaign_links')
          .select('id')
          .eq('unique_token', link_token)
          .eq('campaign_id', campaign_id)
          .eq('is_active', true)
          .maybeSingle();
        tokenValid = !!campaignLink;
      }
      
      if (!tokenValid) {
        return new Response(JSON.stringify({
          error: 'Invalid token'
        }), {
          status: 401,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      
      // Create submission
      const { data: submission, error: submissionError } = await supabase
        .from('survey_submissions')
        .insert({
          campaign_id,
          link_token,
          link_type,
          room_name,
          s3_recording_url,
          call_timestamp: call_timestamp || new Date().toISOString()
        })
        .select()
        .single();
      
      if (submissionError) {
        return new Response(JSON.stringify({
          error: 'Failed to create submission',
          details: submissionError.message
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      
      return new Response(JSON.stringify({
        submission_id: submission.id,
        success: true
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    // GET /submissions/{submission_id}/answers
    if (method === 'GET' && path.match(/^\/(?:api\/)?submissions\/([^\/]+)\/answers$/)) {
      const match = path.match(/^\/(?:api\/)?submissions\/([^\/]+)\/answers$/);
      const submissionId = match?.[1];
      
      if (!submissionId) {
        return new Response(JSON.stringify({
          error: 'Submission ID is required'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      
      const { data: answers, error } = await supabase
        .from('answer')
        .select('*')
        .eq('survey_submission_id', submissionId);
      
      if (error) {
        return new Response(JSON.stringify({
          error: 'Failed to get answers'
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      
      return new Response(JSON.stringify({
        answers: answers || []
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    // POST /submissions/{submission_id}/answers
    if (method === 'POST' && path.match(/^\/(?:api\/)?submissions\/([^\/]+)\/answers$/)) {
      const match = path.match(/^\/(?:api\/)?submissions\/([^\/]+)\/answers$/);
      const submissionId = match?.[1];
      const body = await req.json();
      const { answers } = body;
      
      if (!submissionId || !answers || !Array.isArray(answers)) {
        return new Response(JSON.stringify({
          error: 'Missing required fields: answers (array)'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      
      // Verify submission exists
      const { data: submission } = await supabase
        .from('survey_submissions')
        .select('id')
        .eq('id', submissionId)
        .single();
      
      if (!submission) {
        return new Response(JSON.stringify({
          error: 'Submission not found'
        }), {
          status: 404,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      
      // Insert answers
      const answerInserts = answers.map((answer) => ({
        survey_submission_id: submissionId,
        question_id: answer.question_id,
        answer_text: answer.answer_text
      }));
      
      const { error: answersError } = await supabase
        .from('answer')
        .insert(answerInserts);
      
      if (answersError) {
        return new Response(JSON.stringify({
          error: 'Failed to save answers',
          details: answersError.message
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      
      return new Response(JSON.stringify({
        success: true,
        answers_saved: answers.length
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    // PUT /submissions/{submission_id}
    if (method === 'PUT' && path.match(/^\/(?:api\/)?submissions\/([^\/]+)$/)) {
      const match = path.match(/^\/(?:api\/)?submissions\/([^\/]+)$/);
      const submissionId = match?.[1];
      const body = await req.json();
      
      if (!submissionId) {
        return new Response(JSON.stringify({
          error: 'Submission ID is required'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      
      const { data, error } = await supabase
        .from('survey_submissions')
        .update(body)
        .eq('id', submissionId)
        .select()
        .single();
      
      if (error) {
        return new Response(JSON.stringify({
          error: 'Failed to update submission'
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      
      return new Response(JSON.stringify(data), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    // PATCH /submissions/{submission_id} (keep existing)
    if (method === 'PATCH' && path.match(/^\/(?:api\/)?submissions\/([^\/]+)$/)) {
      const match = path.match(/^\/(?:api\/)?submissions\/([^\/]+)$/);
      const submissionId = match?.[1];
      const body = await req.json();
      
      if (!submissionId) {
        return new Response(JSON.stringify({
          error: 'Submission ID is required'
        }), {
          status: 400,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      
      // Update submission
      const updateData = {
        updated_at: new Date().toISOString()
      };
      if (body.s3_recording_url) updateData.s3_recording_url = body.s3_recording_url;
      if (body.call_timestamp) updateData.call_timestamp = body.call_timestamp;
      if (body.room_name) updateData.room_name = body.room_name;
      
      const { error: updateError } = await supabase
        .from('survey_submissions')
        .update(updateData)
        .eq('id', submissionId);
      
      if (updateError) {
        return new Response(JSON.stringify({
          error: 'Failed to update submission',
          details: updateError.message
        }), {
          status: 500,
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json'
          }
        });
      }
      
      return new Response(JSON.stringify({
        success: true,
        message: 'Submission updated successfully'
      }), {
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
    
    // Route not found - include debug info
    return new Response(JSON.stringify({
      error: 'Route not found',
      debug: {
        method,
        fullPath,
        path,
        url: req.url,
        searchParams: Object.fromEntries(url.searchParams)
      }
    }), {
      status: 404,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
    
  } catch (error) {
    console.error('Survey API Error:', error);
    return new Response(JSON.stringify({
      error: 'Internal server error'
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
