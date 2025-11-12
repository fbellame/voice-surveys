import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface GenerateQuizRequest {
  document_id: string;
  target_count?: number;
  types?: string[];
  difficulty_mix?: {
    understand?: number;
    apply?: number;
    analyze?: number;
  };
  title?: string;
}

interface QuestionItem {
  type: "mcq" | "true_false" | "short_answer" | "cloze";
  prompt: string;
  options?: string[];
  correct_answer: string | number | boolean;
  rationale: string;
  bloom_level?: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
  source_chunk_id?: string;
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
    const body: GenerateQuizRequest = await req.json();

    const {
      document_id,
      target_count = 15,
      types = ["mcq", "true_false", "short_answer"],
      difficulty_mix = { understand: 60, apply: 25, analyze: 15 },
      title,
    } = body;

    if (!document_id) {
      return new Response(
        JSON.stringify({ error: "document_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get document and chunks
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("*")
      .eq("id", document_id)
      .single();

    if (docError || !document) {
      return new Response(
        JSON.stringify({ error: "Document not found", details: docError }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: chunks, error: chunksError } = await supabase
      .from("doc_chunks")
      .select("*")
      .eq("document_id", document_id)
      .order("idx", { ascending: true });

    if (chunksError || !chunks || chunks.length === 0) {
      return new Response(
        JSON.stringify({ error: "No chunks found for document", details: chunksError }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate questions per chunk (aim for target_count total)
    const questionsPerChunk = Math.max(1, Math.ceil(target_count / chunks.length));
    const allQuestions: QuestionItem[] = [];

    // Process chunks in batches
    const batchSize = 3;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const batchPromises = batch.map((chunk) =>
        generateQuestionsForChunk(chunk.text, questionsPerChunk, types, difficulty_mix, OPENAI_API_KEY || "")
      );

      const batchResults = await Promise.all(batchPromises);
      for (let j = 0; j < batch.length; j++) {
        const questions = batchResults[j];
        if (questions && questions.length > 0) {
          questions.forEach((q: any) => {
            q.source_chunk_id = batch[j].id;
          });
          allQuestions.push(...questions);
        } else {
          console.warn(`No questions generated for chunk ${batch[j].id}`);
        }
      }
    }

    if (allQuestions.length === 0) {
      return new Response(
        JSON.stringify({ 
          error: "No questions could be generated. Please check OPENAI_API_KEY and try again.",
          details: OPENAI_API_KEY ? "OpenAI API call may have failed" : "OPENAI_API_KEY not configured"
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Limit to target_count and shuffle
    const selectedQuestions = shuffleArray(allQuestions).slice(0, target_count);

    // Create quiz record
    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .insert({
        document_id,
        title: title || `${document.title} - Quiz`,
        difficulty_mix,
        settings: { types, target_count },
      })
      .select()
      .single();

    if (quizError || !quiz) {
      return new Response(
        JSON.stringify({ error: "Failed to create quiz", details: quizError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert questions
    const questionInserts = selectedQuestions.map((q) => ({
      quiz_id: quiz.id,
      type: q.type,
      prompt: q.prompt,
      options: q.type === "mcq" ? q.options : null,
      correct_answer: q.correct_answer,
      rationale: q.rationale,
      source_chunk_id: q.source_chunk_id,
      bloom_level: q.bloom_level || "understand",
    }));

    const { error: questionsError } = await supabase
      .from("questions")
      .insert(questionInserts);

    if (questionsError) {
      return new Response(
        JSON.stringify({ error: "Failed to insert questions", details: questionsError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        quiz_id: quiz.id,
        questions_count: selectedQuestions.length,
        message: "Quiz generated successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error generating quiz:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function generateQuestionsForChunk(
  chunkText: string,
  count: number,
  types: string[],
  difficultyMix: { understand?: number; apply?: number; analyze?: number },
  apiKey: string
): Promise<(QuestionItem & { source_chunk_id?: string })[]> {
  const prompt = `You are an expert educational content creator. Generate high-quality quiz questions from the following text.

Context:
${chunkText}

Requirements:
- Generate ${count} questions total
- Types: ${types.join(", ")}
- Difficulty mix: ${difficultyMix.understand || 60}% Understand, ${difficultyMix.apply || 25}% Apply, ${difficultyMix.analyze || 15}% Analyze
- For MCQ: provide 1 correct answer and 3 plausible distractors
- For True/False: provide justification
- For Short Answer: expect 2-3 sentences
- Include rationale (1-2 sentences) for each question
- Vary cognitive levels appropriately

Return ONLY valid JSON in this exact format:
{
  "items": [
    {
      "type": "mcq" | "true_false" | "short_answer",
      "prompt": "question text",
      "options": ["option1", "option2", "option3", "option4"] (only for MCQ),
      "correct_answer": "answer" (string for MCQ/short_answer, boolean for true_false),
      "rationale": "explanation",
      "bloom_level": "understand" | "apply" | "analyze"
    }
  ]
}`;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You create high-quality educational quizzes. Be precise and avoid ambiguity. Always return valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No content in OpenAI response");
    }

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const items = parsed.items || [];
    if (items.length === 0) {
      console.warn("No questions generated from OpenAI response");
    }
    return items;
  } catch (error: any) {
    console.error("Error generating questions:", error);
    if (error.message) {
      console.error("Error message:", error.message);
    }
    // Don't try to access content here as it might not be defined
    return [];
  }
}

function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

