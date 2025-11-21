import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface GenerateLessonRequest {
  quiz_id: string; // Now requires quiz_id instead of document_id
  title?: string;
  parts_count?: number;
}

interface LessonPart {
  part_number: number;
  title: string;
  content: string;
  summary: string;
  learning_objectives: string[];
  key_concepts: string[];
  examples: string[];
  chunk_ids: string[];
}

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: GenerateLessonRequest = await req.json();

    const {
      quiz_id,
      title,
      parts_count,
    } = body;

    if (!quiz_id) {
      return new Response(
        JSON.stringify({ error: "quiz_id is required. Please generate a quiz first." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get quiz
    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .select("*")
      .eq("id", quiz_id)
      .single();

    if (quizError || !quiz) {
      console.error("Quiz error:", quizError);
      return new Response(
        JSON.stringify({ error: "Quiz not found", details: quizError?.message || String(quizError) }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get document separately
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", quiz.document_id)
      .single();

    if (docError || !document) {
      console.error("Document error:", docError);
      return new Response(
        JSON.stringify({ error: "Document not found for quiz", details: docError?.message || String(docError) }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all questions for this quiz
    const { data: questions, error: questionsError } = await supabase
      .from("questions")
      .select("*")
      .eq("quiz_id", quiz_id)
      .order("created_at", { ascending: true });

    if (questionsError || !questions || questions.length === 0) {
      return new Response(
        JSON.stringify({ error: "No questions found for quiz. Please ensure the quiz has questions." }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get unique source chunks from questions
    const sourceChunkIds = [...new Set(
      questions
        .map((q: any) => q.source_chunk_id)
        .filter((id: string | null) => id !== null)
    )];

    if (sourceChunkIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "Quiz questions don't have source chunks. Please regenerate the quiz." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the actual chunk content
    const { data: chunks, error: chunksError } = await supabase
      .from("doc_chunks")
      .select("*")
      .in("id", sourceChunkIds)
      .order("idx", { ascending: true });

    if (chunksError || !chunks || chunks.length === 0) {
      return new Response(
        JSON.stringify({ error: "No chunks found for quiz questions", details: chunksError }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prepare quiz questions summary for lesson generation
    const questionsSummary = questions.map((q: any, idx: number) => {
      const questionText = q.prompt;
      const correctAnswer = typeof q.correct_answer === 'object' 
        ? JSON.stringify(q.correct_answer) 
        : String(q.correct_answer);
      const rationale = q.rationale || "";
      const type = q.type;
      const bloomLevel = q.bloom_level || "understand";
      
      return `Question ${idx + 1} (${type}, ${bloomLevel}): ${questionText}\nCorrect Answer: ${correctAnswer}\nRationale: ${rationale}`;
    }).join("\n\n");

    // Determine optimal number of parts (3-6 parts based on content size)
    const optimalPartsCount = parts_count || Math.min(Math.max(3, Math.ceil(chunks.length / 3)), 6);
    
    // Group chunks into parts (distribute chunks evenly across parts)
    const chunksPerPart = Math.ceil(chunks.length / optimalPartsCount);
    const chunkGroups: typeof chunks[] = [];
    
    for (let i = 0; i < chunks.length; i += chunksPerPart) {
      chunkGroups.push(chunks.slice(i, i + chunksPerPart));
    }

    // Group questions by their source chunks for each part
    const questionsByPart: any[][] = [];
    for (let i = 0; i < chunkGroups.length; i++) {
      const chunkGroup = chunkGroups[i];
      const chunkIds = new Set(chunkGroup.map(c => c.id));
      const partQuestions = questions.filter((q: any) => 
        q.source_chunk_id && chunkIds.has(q.source_chunk_id)
      );
      questionsByPart.push(partQuestions);
    }

    // Generate lesson structure using OpenAI, focusing on quiz content
    const chunksText = chunks.map(c => c.text).join("\n\n");
    const questionsPreview = questions.slice(0, 5).map((q: any) => q.prompt).join("\n");

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are an expert educational content creator. Your task is to create a structured lesson that specifically prepares students for a quiz. 
            The lesson must cover the exact content that will be tested in the quiz questions. 
            Make it educational, clear, and ensure students understand the material needed to answer the quiz questions correctly.`
          },
          {
            role: "user",
            content: `Create a comprehensive lesson that prepares students for this quiz. The quiz has ${questions.length} questions covering specific content from the document.

Document Title: ${document.title}
Quiz Title: ${quiz.title}

Quiz Questions Preview (${questions.length} total):
${questionsPreview}
...

Source Content from Document:
${chunksText.substring(0, 8000)}

IMPORTANT: 
- The lesson MUST cover the content needed to answer ALL quiz questions correctly
- Focus on the concepts, facts, and information that are directly tested in the quiz
- Organize content into ${optimalPartsCount} parts that build progressively
- Each part should prepare students for specific quiz questions
- Include examples and explanations that relate directly to the quiz questions

Create:
1. A lesson overview (2-3 sentences explaining what students will learn to prepare for the quiz)
2. ${optimalPartsCount} lesson parts, each with:
   - A descriptive title related to the quiz content
   - Comprehensive content explaining the concepts needed for the quiz (3-5 paragraphs)
   - A brief summary (2-3 sentences)
   - 2-3 learning objectives that align with quiz questions
   - 3-5 key concepts that are tested in the quiz
   - 1-2 practical examples that help answer quiz questions

Return a JSON object with this structure:
{
  "overview": "Lesson overview text",
  "parts": [
    {
      "title": "Part title",
      "content": "Detailed content explaining concepts needed for quiz...",
      "summary": "Brief summary",
      "learning_objectives": ["objective 1", "objective 2"],
      "key_concepts": ["concept 1", "concept 2", "concept 3"],
      "examples": ["example 1", "example 2"]
    }
  ]
}

Make the lesson directly relevant to the quiz questions. Students should be able to answer the quiz questions after studying this lesson.`
          }
        ],
        temperature: 0.7,
        max_tokens: 4000,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("OpenAI API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to generate lesson content", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiData = await openaiResponse.json();
    const lessonContentText = openaiData.choices[0]?.message?.content || "";

    // Parse the JSON response
    let lessonStructure: {
      overview: string;
      parts: Array<{
        title: string;
        content: string;
        summary: string;
        learning_objectives: string[];
        key_concepts: string[];
        examples: string[];
      }>;
    };

    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = lessonContentText.match(/```json\s*([\s\S]*?)\s*```/) || 
                       lessonContentText.match(/```\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        lessonStructure = JSON.parse(jsonMatch[1]);
      } else {
        // Try to find JSON object directly
        const objectMatch = lessonContentText.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          lessonStructure = JSON.parse(objectMatch[0]);
        } else {
          throw new Error("No JSON found in response");
        }
      }
    } catch (parseError) {
      console.error("Failed to parse lesson structure:", parseError);
      console.error("Raw response:", lessonContentText.substring(0, 500));
      return new Response(
        JSON.stringify({ error: "Failed to parse lesson structure", details: parseError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Ensure we have the right number of parts
    if (!lessonStructure.parts || lessonStructure.parts.length !== optimalPartsCount) {
      // If OpenAI didn't generate enough parts, create them from chunk groups
      const generatedParts = lessonStructure.parts || [];
      const remainingParts = optimalPartsCount - generatedParts.length;
      
      for (let i = generatedParts.length; i < optimalPartsCount; i++) {
        const chunkGroup = chunkGroups[i] || [];
        const partQuestions = questionsByPart[i] || [];
        const groupText = chunkGroup.map(c => c.text).join("\n\n");
        const questionsText = partQuestions.map((q: any, idx: number) => 
          `Q${idx + 1}: ${q.prompt} (Answer: ${q.correct_answer})`
        ).join("\n");
        
        // Generate content for this part
        const partResponse = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "You are an expert educational content creator. Create lesson content that prepares students for specific quiz questions."
              },
              {
                role: "user",
                content: `Create lesson part ${i + 1} content that prepares students for these quiz questions:

Quiz Questions for this part:
${questionsText}

Source Content:
${groupText.substring(0, 3000)}

Return JSON: {"title": "...", "content": "...", "summary": "...", "learning_objectives": [...], "key_concepts": [...], "examples": [...]}
Make sure the content directly helps students answer the quiz questions.`
              }
            ],
            temperature: 0.7,
            max_tokens: 1500,
          }),
        });

        if (partResponse.ok) {
          const partData = await partResponse.json();
          const partText = partData.choices[0]?.message?.content || "";
          try {
            const jsonMatch = partText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const partContent = JSON.parse(jsonMatch[0]);
              generatedParts.push(partContent);
            }
          } catch (e) {
            console.error("Failed to parse part content:", e);
          }
        }
      }
      
      lessonStructure.parts = generatedParts.slice(0, optimalPartsCount);
    }

    // Create lesson record linked to quiz
    let lessonData: any = {
      document_id: document.id,
      title: title || `${quiz.title} - Learning Lesson`,
      description: `A structured lesson to help you prepare for the quiz: "${quiz.title}"`,
      overview: lessonStructure.overview,
      estimated_duration_minutes: optimalPartsCount * 5, // ~5 minutes per part
    };
    
    // Add quiz_id if the column exists (migration may not be applied yet)
    lessonData.quiz_id = quiz_id;

    let lesson: any = null;
    let lessonError: any = null;

    // Try to insert with quiz_id first
    const { data: lessonResult, error: lessonErr } = await supabase
      .from("document_lessons")
      .insert(lessonData)
      .select()
      .single();

    lesson = lessonResult;
    lessonError = lessonErr;

    // If quiz_id column doesn't exist, try without it
    if (lessonError && (lessonError?.message?.includes("quiz_id") || lessonError?.code === "42703" || lessonError?.message?.includes("column") && lessonError?.message?.includes("quiz_id"))) {
      console.warn("quiz_id column may not exist, retrying without it");
      delete lessonData.quiz_id;
      const { data: lessonRetry, error: lessonRetryError } = await supabase
        .from("document_lessons")
        .insert(lessonData)
        .select()
        .single();
      
      lesson = lessonRetry;
      lessonError = lessonRetryError;
    }

    if (lessonError || !lesson) {
      console.error("Lesson creation error:", lessonError);
      return new Response(
        JSON.stringify({ 
          error: "Failed to create lesson", 
          details: lessonError?.message || String(lessonError),
          hint: lessonError?.message?.includes("quiz_id") ? "Make sure to run the migration: 20250124000001_add_quiz_id_to_document_lessons.sql" : undefined
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create lesson parts and link to chunks
    const partInserts = [];
    for (let i = 0; i < lessonStructure.parts.length && i < chunkGroups.length; i++) {
      const partData = lessonStructure.parts[i];
      const chunkGroup = chunkGroups[i];

      // Create lesson part
      const { data: lessonPart, error: partError } = await supabase
        .from("lesson_parts")
        .insert({
          lesson_id: lesson.id,
          part_number: i + 1,
          title: partData.title || `Part ${i + 1}`,
          content: partData.content || "",
          summary: partData.summary || "",
          learning_objectives: partData.learning_objectives || [],
          key_concepts: partData.key_concepts || [],
          examples: partData.examples || [],
        })
        .select()
        .single();

      if (partError || !lessonPart) {
        console.error(`Error creating lesson part ${i + 1}:`, partError);
        continue;
      }

      // Link chunks to this part
      if (chunkGroup && chunkGroup.length > 0) {
        const chunkLinks = chunkGroup.map(chunk => ({
          lesson_part_id: lessonPart.id,
          chunk_id: chunk.id,
        }));

        const { error: linksError } = await supabase
          .from("lesson_part_chunks")
          .insert(chunkLinks);

        if (linksError) {
          console.error(`Error linking chunks to part ${i + 1}:`, linksError);
        }
      }

      partInserts.push(lessonPart);
    }

    return new Response(
      JSON.stringify({
        lesson_id: lesson.id,
        parts_count: partInserts.length,
        message: "Lesson generated successfully based on quiz content",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error generating lesson:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
