import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface QuizQuestion {
  question_text: string;
  correct_answer: string;
  points: number;
  explanation: string;
  is_quiz_question: boolean;
}

// Extract text from PDF using a simple approach
// Since pdfjs-dist doesn't work well in Deno edge functions, we'll use a workaround
// For now, we'll skip text extraction and let OpenAI handle the PDF directly
// by uploading it and using the Assistants API or by processing it in chunks
async function extractTextFromPDF(pdfBuffer: ArrayBuffer, openaiApiKey: string): Promise<string> {
  try {
    // Upload PDF to OpenAI Files API
    const formData = new FormData();
    const blob = new Blob([pdfBuffer], { type: 'application/pdf' });
    formData.append('file', blob, 'document.pdf');
    formData.append('purpose', 'assistants');
    
    console.log('Uploading PDF to OpenAI...');
    const uploadResponse = await fetch('https://api.openai.com/v1/files', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: formData
    });
    
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('OpenAI file upload error:', errorText);
      throw new Error(`Failed to upload PDF to OpenAI: ${uploadResponse.status}`);
    }
    
    const fileData = await uploadResponse.json();
    const fileId = fileData.id;
    console.log(`PDF uploaded to OpenAI with file ID: ${fileId}`);
    
    // Wait for file to be processed
    let fileReady = false;
    let attempts = 0;
    while (!fileReady && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const statusResponse = await fetch(`https://api.openai.com/v1/files/${fileId}`, {
        headers: { 'Authorization': `Bearer ${openaiApiKey}` }
      });
      const statusData = await statusResponse.json();
      if (statusData.status === 'processed') {
        fileReady = true;
      }
      attempts++;
    }
    
    if (!fileReady) {
      throw new Error('PDF file processing timeout');
    }
    
    // Use OpenAI Assistants API to extract text
    // Create a temporary assistant
    const assistantResponse = await fetch('https://api.openai.com/v1/assistants', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        instructions: 'Extract all text content from the provided PDF document. Return ONLY the extracted text, preserving structure and formatting. Do not add commentary.',
        tools: [{ type: 'code_interpreter' }],
        tool_resources: {
          code_interpreter: {
            file_ids: [fileId]
          }
        }
      })
    });
    
    if (!assistantResponse.ok) {
      const errorText = await assistantResponse.text();
      console.error('OpenAI assistant creation error:', errorText);
      // Clean up file
      await fetch(`https://api.openai.com/v1/files/${fileId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${openaiApiKey}` }
      });
      throw new Error(`Failed to create assistant: ${assistantResponse.status}`);
    }
    
    const assistantData = await assistantResponse.json();
    const assistantId = assistantData.id;
    
    // Create a thread and run
    const threadResponse = await fetch('https://api.openai.com/v1/threads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        messages: [{
          role: 'user',
          content: 'Extract all text from the PDF file.'
        }]
      })
    });
    
    const threadData = await threadResponse.json();
    const threadId = threadData.id;
    
    // Create a run
    const runResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        assistant_id: assistantId
      })
    });
    
    const runData = await runResponse.json();
    const runId = runData.id;
    
    // Poll for completion
    let runComplete = false;
    attempts = 0;
    while (!runComplete && attempts < 30) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      const runStatusResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/runs/${runId}`, {
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      });
      const runStatus = await runStatusResponse.json();
      if (runStatus.status === 'completed') {
        runComplete = true;
      } else if (runStatus.status === 'failed') {
        throw new Error('Run failed');
      }
      attempts++;
    }
    
    if (!runComplete) {
      throw new Error('Run timeout');
    }
    
    // Get messages
    const messagesResponse = await fetch(`https://api.openai.com/v1/threads/${threadId}/messages`, {
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'OpenAI-Beta': 'assistants=v2'
      }
    });
    
    const messagesData = await messagesResponse.json();
    const extractedText = messagesData.data[0]?.content[0]?.text?.value || '';
    
    // Cleanup: delete assistant, thread, and file
    try {
      await fetch(`https://api.openai.com/v1/assistants/${assistantId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'OpenAI-Beta': 'assistants=v2'
        }
      });
      await fetch(`https://api.openai.com/v1/files/${fileId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${openaiApiKey}` }
      });
    } catch (e) {
      console.warn('Cleanup error:', e);
    }
    
    if (!extractedText) {
      throw new Error('No text extracted from PDF');
    }
    
    console.log(`Extracted ${extractedText.length} characters from PDF`);
    return extractedText.trim();
  } catch (error) {
    console.error('Error extracting text from PDF:', error);
    throw new Error(`Failed to extract text from PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Generate quiz questions using OpenAI
async function generateQuizQuestions(pdfText: string, openaiApiKey: string): Promise<QuizQuestion[]> {
  const prompt = `Based on the following educational content from a PDF, generate exactly 5 quiz questions. Each question should:
1. Test understanding of key concepts
2. Have a clear, concise correct answer
3. Include a brief explanation
4. Be worth 1 point each

Return ONLY a valid JSON array with this exact structure:
[
  {
    "question_text": "Question here?",
    "correct_answer": "Correct answer",
    "points": 1,
    "explanation": "Brief explanation",
    "is_quiz_question": true
  }
]

PDF Content:
${pdfText.substring(0, 12000)}`; // Limit to ~12k chars to stay within token limits

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an educational content expert. Generate quiz questions based on the provided content. Return ONLY valid JSON, no other text.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();
    
    if (!content) {
      throw new Error('No content returned from OpenAI');
    }

    // Extract JSON from response (handle cases where there might be markdown code blocks)
    let jsonContent = content;
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1];
    }

    const questions = JSON.parse(jsonContent);
    
    // Validate and ensure we have exactly 5 questions
    if (!Array.isArray(questions)) {
      throw new Error('Invalid response format: expected array');
    }

    // Ensure all questions have required fields
    return questions.slice(0, 5).map((q: any, index: number) => ({
      question_text: q.question_text || `Question ${index + 1}`,
      correct_answer: q.correct_answer || '',
      points: q.points || 1,
      explanation: q.explanation || '',
      is_quiz_question: true,
      question_order: index + 1
    }));
  } catch (error) {
    console.error('Error generating quiz questions:', error);
    throw error;
  }
}

// Generate lesson prompt using OpenAI
async function generateLessonPrompt(pdfText: string, openaiApiKey: string): Promise<string> {
  const prompt = `Based on the following educational content from a PDF, create a comprehensive lesson introduction prompt for an AI teacher. The prompt should:
1. Explain the lesson topic and objectives
2. Provide context about what students will learn
3. Guide the AI teacher on how to present the material
4. Be engaging and educational

Return ONLY the prompt text, no additional formatting or explanations.

PDF Content:
${pdfText.substring(0, 12000)}`; // Limit to ~12k chars

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: 'You are an educational content expert. Create lesson prompts for AI teachers. Return ONLY the prompt text, no additional formatting.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('OpenAI API error:', errorData);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();
    
    if (!content) {
      throw new Error('No content returned from OpenAI');
    }

    return content;
  } catch (error) {
    console.error('Error generating lesson prompt:', error);
    throw error;
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Get authenticated user from the request
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Create client with anon key to verify user
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify user is authenticated
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('User authenticated:', user.id);

    // Create service role client for storage operations
    const supabaseService = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    // Parse the multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return new Response(
        JSON.stringify({ error: 'File must be a PDF' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate file size (10MB limit)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return new Response(
        JSON.stringify({ error: 'File size exceeds 10MB limit' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('File received:', {
      name: file.name,
      size: file.size,
      type: file.type
    });

    // Generate unique filename
    const fileExt = file.name.split('.').pop() || 'pdf';
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `lessons/${fileName}`;

    // Convert File to ArrayBuffer for upload
    const fileBuffer = await file.arrayBuffer();

    // Upload file to storage using service role key
    const { data: uploadData, error: uploadError } = await supabaseService.storage
      .from('lesson-documents')
      .upload(filePath, fileBuffer, {
        cacheControl: '3600',
        upsert: false,
        contentType: 'application/pdf'
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to upload file',
          details: uploadError.message 
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('File uploaded successfully:', uploadData.path);

    // Get public URL
    const { data: { publicUrl } } = supabaseService.storage
      .from('lesson-documents')
      .getPublicUrl(filePath);

    // Extract text from PDF and generate content
    console.log('Processing PDF with OpenAI...');
    let extractedText = '';
    let quizQuestions: QuizQuestion[] = [];
    let lessonPrompt = '';

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.warn('OPENAI_API_KEY not set, skipping PDF processing and AI generation');
    } else {
      try {
        // Extract text from PDF using OpenAI
        extractedText = await extractTextFromPDF(fileBuffer, openaiApiKey);
        console.log(`Extracted ${extractedText.length} characters from PDF`);

        // Generate quiz questions and lesson prompt in parallel
        console.log('Generating quiz questions and lesson prompt...');
        [quizQuestions, lessonPrompt] = await Promise.all([
          generateQuizQuestions(extractedText, openaiApiKey),
          generateLessonPrompt(extractedText, openaiApiKey)
        ]);
        console.log(`Generated ${quizQuestions.length} quiz questions and lesson prompt`);
      } catch (error) {
        console.error('Error processing PDF:', error);
        // Continue even if PDF processing fails - return what we have
        // The frontend can handle partial data
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        filePath: uploadData.path,
        fileName: fileName,
        publicUrl: publicUrl,
        fileSize: file.size,
        uploadedBy: user.id,
        extractedText: extractedText,
        quizQuestions: quizQuestions,
        lessonPrompt: lessonPrompt
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in upload-lesson-document:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

