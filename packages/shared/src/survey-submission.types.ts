export interface SurveySubmissionData {
  campaign_id: number;
  link_token: string;
  link_type: 'generic' | 'personal';
  room_name?: string;
  s3_recording_url?: string;
  call_timestamp?: string;
}

export interface AnonymousSubmissionData extends SurveySubmissionData {
  link_type: 'generic';
  // For anonymous submissions, we don't create user profiles
}

export interface PersonalSubmissionData extends SurveySubmissionData {
  link_type: 'personal';
  user_profile_data: {
    full_name?: string;
    email?: string;
    geography?: string;
    occupation?: string;
    phone_number?: string;
    invitation_token?: string;
  };
}
