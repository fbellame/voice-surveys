import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';
import OpenAI from 'jsr:@openai/openai';

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

// Skip expensive text extraction - we'll generate questions based on PDF metadata
// NO file uploads, NO assistants API, NO code interpreter - just cheap responses.create API
async function generateContentFromPDF(fileName: string, pdfUrl: string, openaiApiKey: string): Promise<{ extractedText: string; quizQuestions: QuizQuestion[]; lessonPrompt: string }> {
  try {
    const client = new OpenAI({ apiKey: openaiApiKey });
    
    console.log('Generating quiz questions and lesson prompt from PDF (no expensive extraction)...');
    
    // Generate questions and prompt in parallel using only responses.create API
    // This is much cheaper - no file uploads, no assistants, no code interpreter
    const [questionsResponse, promptResponse] = await Promise.all([
      client.responses.create({
        model: 'gpt-4o-mini',
        instructions: `You are an educational content expert. Generate exactly 5 quiz questions based on a PDF document. 

IMPORTANT: 
- Base questions on the PDF filename and URL provided
- Generate questions that would be appropriate for the topic suggested by the filename
- Do NOT generate generic questions about PDFs, documents, or file formats
- Each question must test understanding of educational concepts
- Questions should be specific and educational

Return a JSON object with a "questions" key containing an array of exactly 5 questions. Use this structure:
{
  "questions": [
    {
      "question_text": "Educational question?",
      "correct_answer": "Answer",
      "points": 1,
      "explanation": "Explanation",
      "is_quiz_question": true
    }
  ]
}`,
        input: `Generate 5 educational quiz questions based on this PDF document:
- Filename: ${fileName}
- URL: ${pdfUrl}

Create questions that would be appropriate for this educational material.`
      }),
      client.responses.create({
        model: 'gpt-4o-mini',
        instructions: 'You are an educational content expert. Create a comprehensive lesson introduction prompt for an AI teacher based on a PDF document. Return ONLY the prompt text, no additional formatting.',
        input: `Create a lesson introduction prompt for an AI teacher based on this PDF:
- Filename: ${fileName}
- URL: ${pdfUrl}

The prompt should explain the lesson topic, objectives, and guide the AI teacher on how to present the material.`
      })
    ]);
    
    const questionsJson = questionsResponse.output_text.trim();
    const lessonPrompt = promptResponse.output_text.trim();
    
    // Parse questions
    let questions: QuizQuestion[] = [];
    try {
      let parsed;
      try {
        // Try parsing directly first
        parsed = JSON.parse(questionsJson);
      } catch (parseError) {
        // Try extracting JSON from markdown code blocks
        const jsonMatch = questionsJson.match(/```json\s*([\s\S]*?)\s*```/) || questionsJson.match(/```\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[1]);
        } else {
          // Try to find JSON object directly
          const objectMatch = questionsJson.match(/\{[\s\S]*\}/);
          if (objectMatch) {
            parsed = JSON.parse(objectMatch[0]);
          } else {
            throw new Error('Invalid JSON response format');
          }
        }
      }
      
      questions = (parsed.questions || parsed).slice(0, 5).map((q: any, index: number) => ({
        question_text: q.question_text || q.question || `Question ${index + 1}`,
        correct_answer: q.correct_answer || q.answer || '',
        points: q.points || 1,
        explanation: q.explanation || '',
        is_quiz_question: true,
        question_order: index + 1
      }));
    } catch (e) {
      console.error('Failed to parse questions:', e);
      console.error('Raw response:', questionsJson.substring(0, 500));
    }
    
    return {
      extractedText: '', // No text extraction to save costs
      quizQuestions: questions,
      lessonPrompt: lessonPrompt
    };
  } catch (error) {
    console.error('Error generating content from PDF:', error);
    return {
      extractedText: '',
      quizQuestions: [],
      lessonPrompt: ''
    };
  }
}

// Generate quiz questions using OpenAI SDK with responses.create API
async function generateQuizQuestions(pdfText: string, openaiApiKey: string): Promise<QuizQuestion[]> {
  try {
    const client = new OpenAI({ apiKey: openaiApiKey });
    
    // Use the actual PDF text content - make sure we're using the real content
    const pdfContent = pdfText.substring(0, 15000); // Use more content for better context
    
    console.log(`Generating quiz questions from PDF content (${pdfContent.length} chars)...`);
    
    const response = await client.responses.create({
      model: 'gpt-4o-mini',
      instructions: `You are an educational content expert. Your task is to generate quiz questions based on the ACTUAL CONTENT provided from a PDF document. 

IMPORTANT: 
- You MUST base your questions ONLY on the specific content provided
- Do NOT generate generic questions about PDFs, documents, or file formats
- Each question must test understanding of the ACTUAL TOPICS, CONCEPTS, and INFORMATION in the provided content
- Questions should be specific to the material, not generic educational questions

Return a JSON object with a "questions" key containing an array of exactly 5 questions. Use this exact structure:
{
  "questions": [
    {
      "question_text": "Specific question about the content?",
      "correct_answer": "Answer from the content",
      "points": 1,
      "explanation": "Brief explanation based on the content",
      "is_quiz_question": true
    }
  ]
}`,
      input: `Based on the following ACTUAL CONTENT extracted from a PDF document, generate exactly 5 quiz questions that test understanding of the specific topics, concepts, and information presented in this content.

Each question should:
1. Be directly related to the specific content provided below
2. Test understanding of key concepts, facts, or information from the content
3. Have a clear, concise correct answer that can be found in the content
4. Include a brief explanation
5. Be worth 1 point each

ACTUAL PDF CONTENT:
${pdfContent}`
    });

    const content = response.output_text.trim();
    
    if (!content) {
      throw new Error('No content returned from OpenAI');
    }

    console.log('Raw OpenAI response:', content.substring(0, 200));

    // Parse JSON response
    let questions;
    try {
      const parsed = JSON.parse(content);
      if (parsed.questions && Array.isArray(parsed.questions)) {
        questions = parsed.questions;
      } else if (Array.isArray(parsed)) {
        questions = parsed;
      } else {
        throw new Error('Could not find questions array in response');
      }
    } catch (parseError) {
      // Try extracting JSON from markdown code blocks
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || content.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        questions = JSON.parse(jsonMatch[1]).questions || JSON.parse(jsonMatch[1]);
      } else {
        // Try to find JSON object directly
        const objectMatch = content.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          const parsed = JSON.parse(objectMatch[0]);
          questions = parsed.questions || parsed;
        } else {
          console.error('Failed to parse response:', content);
          throw new Error('Invalid JSON response format');
        }
      }
    }
    
    // Validate and ensure we have exactly 5 questions
    if (!Array.isArray(questions)) {
      console.error('Questions is not an array:', questions);
      throw new Error('Invalid response format: expected array');
    }

    // Ensure all questions have required fields and are based on actual content
    const validQuestions = questions.slice(0, 5).map((q: any, index: number) => {
      const questionText = q.question_text || q.question || `Question ${index + 1}`;
      
      // Validate that question is not generic about PDFs
      if (questionText.toLowerCase().includes('pdf') || 
          questionText.toLowerCase().includes('document') ||
          questionText.toLowerCase().includes('file format')) {
        console.warn(`Question ${index + 1} appears to be generic about PDFs: ${questionText}`);
      }
      
      return {
        question_text: questionText,
        correct_answer: q.correct_answer || q.answer || '',
        points: q.points || 1,
        explanation: q.explanation || '',
        is_quiz_question: true,
        question_order: index + 1
      };
    });

    console.log(`Generated ${validQuestions.length} quiz questions`);
    return validQuestions;
  } catch (error) {
    console.error('Error generating quiz questions:', error);
    throw error;
  }
}

// Generate lesson prompt using OpenAI SDK with responses.create API
async function generateLessonPrompt(pdfText: string, openaiApiKey: string): Promise<string> {
  try {
    const client = new OpenAI({ apiKey: openaiApiKey });
    
    const pdfContent = pdfText.substring(0, 15000); // Use more content for better context
    
    console.log('Generating lesson prompt from PDF content...');
    
    const response = await client.responses.create({
      model: 'gpt-4o-mini',
      instructions: 'You are an educational content expert. Create comprehensive lesson introduction prompts for AI teachers based on the actual content provided. Return ONLY the prompt text, no additional formatting or explanations.',
      input: `Based on the following ACTUAL CONTENT extracted from a PDF document, create a comprehensive lesson introduction prompt for an AI teacher. 

The prompt should:
1. Explain the specific lesson topic and objectives based on the content
2. Provide context about what students will learn from this specific material
3. Guide the AI teacher on how to present the material in an engaging way
4. Reference specific concepts, topics, or information from the content
5. Be engaging and educational

IMPORTANT: Base the prompt on the ACTUAL CONTENT provided, not generic educational prompts.

ACTUAL PDF CONTENT:
${pdfContent}`
    });

    const content = response.output_text.trim();
    
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

    // Generate content from PDF using only cheap responses.create API
    // NO file uploads, NO assistants API, NO code interpreter
    console.log('Processing PDF with OpenAI (cheap method - no file uploads)...');
    let extractedText = '';
    let quizQuestions: QuizQuestion[] = [];
    let lessonPrompt = '';

    // Get OpenAI API key from environment
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.warn('OPENAI_API_KEY not set, skipping PDF processing and AI generation');
    } else {
      try {
        // Generate questions and prompt based on PDF metadata (filename, URL)
        // This avoids expensive file uploads and code interpreter
        const result = await generateContentFromPDF(file.name, publicUrl, openaiApiKey);
        extractedText = result.extractedText;
        quizQuestions = result.quizQuestions;
        lessonPrompt = result.lessonPrompt;
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

