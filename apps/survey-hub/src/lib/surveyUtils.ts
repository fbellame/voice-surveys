import { supabase } from '@/integrations/supabase/client';
import type { SurveySubmissionData, AnonymousSubmissionData, PersonalSubmissionData } from '@shared/survey-submission.types';

/**
 * Create a survey submission with proper user profile handling
 * For anonymous generic links, no user profile is created
 * For personal links, a user profile is always created
 */
export async function createSurveySubmission(
  data: AnonymousSubmissionData | PersonalSubmissionData
): Promise<{ submission_id: string; user_profile_id?: string }> {
  const { campaign_id, link_token, link_type, room_name, s3_recording_url, call_timestamp } = data;

  // First, verify the link exists and is valid
  const { data: linkData, error: linkError } = await supabase
    .from('campaign_links')
    .select('id, is_anonymous, is_active, max_responses, current_responses')
    .eq('unique_token', link_token)
    .eq('link_type', link_type)
    .single();

  if (linkError || !linkData) {
    throw new Error('Invalid or expired survey link');
  }

  if (!linkData.is_active) {
    throw new Error('This survey link is no longer active');
  }

  // Check if max responses reached
  if (linkData.max_responses && linkData.current_responses >= linkData.max_responses) {
    throw new Error('Maximum number of responses reached for this survey');
  }

  let user_profile_id: string | undefined;

  // Handle user profile creation based on link type and anonymous setting
  if (link_type === 'personal') {
    // Personal links always create user profiles
    const personalData = data as PersonalSubmissionData;
    const { data: userProfile, error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        campaign_id,
        link_token,
        link_type,
        ...personalData.user_profile_data
      })
      .select('id')
      .single();

    if (profileError) {
      throw new Error('Failed to create user profile');
    }

    user_profile_id = userProfile.id;
  } else if (link_type === 'generic') {
    // For generic links, check if anonymous
    if (!linkData.is_anonymous) {
      // Non-anonymous generic links create user profiles
      const { data: userProfile, error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          campaign_id,
          link_token,
          link_type,
          // For generic links, we don't have user data, so all fields are null
        })
        .select('id')
        .single();

      if (profileError) {
        throw new Error('Failed to create user profile');
      }

      user_profile_id = userProfile.id;
    }
    // For anonymous generic links, no user profile is created (user_profile_id remains undefined)
  }

  // Create the survey submission
  const { data: submission, error: submissionError } = await supabase
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
    .single();

  if (submissionError) {
    throw new Error('Failed to create survey submission');
  }

  return {
    submission_id: submission.id,
    user_profile_id
  };
}

/**
 * Submit answers for a survey submission
 */
export async function submitSurveyAnswers(
  submission_id: string,
  answers: Array<{ question_id: number; answer_text: string }>
): Promise<void> {
  if (answers.length === 0) {
    throw new Error('No answers provided');
  }

  const answersToInsert = answers.map(answer => ({
    survey_submission_id: submission_id,
    question_id: answer.question_id,
    answer_text: answer.answer_text
  }));

  const { error } = await supabase
    .from('answer')
    .insert(answersToInsert);

  if (error) {
    throw new Error('Failed to submit answers');
  }
}

/**
 * Get campaign questions for a survey
 */
export async function getCampaignQuestions(campaign_id: number) {
  const { data: questions, error } = await supabase
    .from('question')
    .select('id, question_text, question_order')
    .eq('campaign_id', campaign_id)
    .order('question_order');

  if (error) {
    throw new Error('Failed to fetch campaign questions');
  }

  return questions;
}

/**
 * Get campaign details for a survey
 */
export async function getCampaignDetails(campaign_id: number) {
  const { data: campaign, error } = await supabase
    .from('campaign')
    .select('id, name, description, intro_prompt, purpose_explanation, greeting, closing')
    .eq('id', campaign_id)
    .single();

  if (error) {
    throw new Error('Failed to fetch campaign details');
  }

  return campaign;
}
