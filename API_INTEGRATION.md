# Voice Survey Hub API Integration Guide

## Anonymous Survey Feature

The Voice Survey Hub now supports anonymous surveys through generic links. This allows external applications (like your Live Chatter app) to conduct surveys without requiring user registration.

## Key Features

### 1. Anonymous Generic Links
- Create generic links with the `is_anonymous: true` flag
- Anonymous surveys don't create user profiles
- Perfect for public surveys where you want to maximize participation

### 2. API Endpoints for External Integration

#### Get Campaign Details
```http
GET /api/campaigns/{campaign_uri}/details?token={link_token}
```

#### Create Anonymous Submission
```http
POST /api/submissions
Content-Type: application/json

{
  "campaign_id": 123,
  "link_token": "your_link_token_here",
  "link_type": "generic",
  "room_name": "optional_room_name",
  "s3_recording_url": "optional_recording_url",
  "call_timestamp": "2024-01-01T12:00:00Z"
}
```

#### Submit Answers
```http
POST /api/submissions/{submission_id}/answers
Content-Type: application/json

{
  "answers": [
    {
      "question_id": 1,
      "answer_text": "User's answer to question 1"
    },
    {
      "question_id": 2,
      "answer_text": "User's answer to question 2"
    }
  ]
}
```

## Implementation Example

Here's how your Live Chatter app can integrate with anonymous surveys:

### 1. Start Survey Session
```javascript
// Get campaign details and questions
const response = await fetch(`/api/campaigns/${campaignUri}/details?token=${linkToken}`);
const campaignData = await response.json();

// Create anonymous submission
const submissionResponse = await fetch('/api/submissions', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    campaign_id: campaignData.id,
    link_token: linkToken,
    link_type: 'generic',
    room_name: 'live-chat-session-123'
  })
});

const { submission_id } = await submissionResponse.json();
```

### 2. Submit Answers During Conversation
```javascript
// Submit answers as the conversation progresses
await fetch(`/api/submissions/${submissionId}/answers`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    answers: [
      {
        question_id: 1,
        answer_text: "User's response to question 1"
      }
    ]
  })
});
```

## Database Schema Changes

### New Field in `campaign_links` table:
- `is_anonymous` (boolean, default: false)
  - When true, allows anonymous survey submissions without creating user profiles

### Survey Submissions:
- `user_profile_id` can be null for anonymous submissions
- All other fields remain the same

## Benefits for Live Chatter Integration

1. **No Registration Required**: Users can participate in surveys immediately without any signup process
2. **Seamless Integration**: Your app can start surveys instantly when users engage
3. **Flexible Data Collection**: You can still collect structured responses while maintaining anonymity
4. **Analytics Support**: Anonymous responses are tracked separately in the analytics dashboard

## Security Considerations

1. **Link Validation**: Always validate the link token before creating submissions
2. **Rate Limiting**: Consider implementing rate limiting for anonymous submissions
3. **Data Privacy**: Anonymous surveys don't store personal information, but ensure compliance with privacy regulations

## Migration Notes

- Existing generic links will have `is_anonymous: false` by default
- You can update existing links to be anonymous if needed
- Anonymous submissions will appear in analytics with "Anonymous" as the respondent name
