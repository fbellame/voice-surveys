import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface GradeRequest {
  attempt_id: string;
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
    const body: GradeRequest = await req.json();

    const { attempt_id } = body;

    if (!attempt_id) {
      return new Response(
        JSON.stringify({ error: "attempt_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get attempt with answers
    const { data: attempt, error: attemptError } = await supabase
      .from("attempts")
      .select(`
        *,
        quiz:quizzes(*),
        answers(*, question:questions(*))
      `)
      .eq("id", attempt_id)
      .single();

    if (attemptError || !attempt) {
      return new Response(
        JSON.stringify({ error: "Attempt not found", details: attemptError }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const answers = attempt.answers || [];
    let correctCount = 0;
    const gradedAnswers = [];

    // Grade each answer
    for (const answer of answers) {
      const question = answer.question;
      if (!question) continue;

      let isCorrect = false;
      let feedback = "";

      if (question.type === "mcq" || question.type === "true_false") {
        // Deterministic grading
        const correctAnswer = question.correct_answer;
        const userAnswer = answer.user_answer;

        if (typeof correctAnswer === "boolean") {
          isCorrect = userAnswer === correctAnswer;
        } else if (typeof correctAnswer === "number") {
          isCorrect = userAnswer === correctAnswer;
        } else {
          // Handle case where userAnswer is an index (number) and correctAnswer is option text (string)
          if (typeof userAnswer === "number" && question.options && Array.isArray(question.options)) {
            // Get the option text at the user's selected index
            const userOptionText = question.options[userAnswer];
            if (userOptionText !== undefined) {
              isCorrect = String(userOptionText).toLowerCase().trim() === String(correctAnswer).toLowerCase().trim();
            } else {
              // Fallback to string comparison
              isCorrect = String(userAnswer).toLowerCase().trim() === String(correctAnswer).toLowerCase().trim();
            }
          } else {
            // Both are strings, compare directly
            isCorrect = String(userAnswer).toLowerCase().trim() === String(correctAnswer).toLowerCase().trim();
          }
        }

        feedback = isCorrect
          ? "Correct! " + (question.rationale || "")
          : `Incorrect. The correct answer is: ${correctAnswer}. ${question.rationale || ""}`;
      } else if (question.type === "short_answer") {
        // LLM judge for short answers
        if (OPENAI_API_KEY) {
          const judgeResult = await judgeShortAnswer(
            question.prompt,
            question.correct_answer as string,
            answer.user_answer as string,
            OPENAI_API_KEY
          );
          isCorrect = judgeResult.correct;
          feedback = judgeResult.feedback;
        } else {
          // Fallback: simple keyword matching
          const correctLower = String(question.correct_answer).toLowerCase();
          const userLower = String(answer.user_answer).toLowerCase();
          const keywords = correctLower.split(/\s+/).filter((w) => w.length > 4);
          const matches = keywords.filter((kw) => userLower.includes(kw)).length;
          isCorrect = matches >= keywords.length * 0.5;
          feedback = isCorrect
            ? "Your answer covers the key points."
            : "Your answer may be missing some key concepts. Review the material.";
        }
      }

      if (isCorrect) correctCount++;

      // Update answer
      const { error: updateError } = await supabase
        .from("answers")
        .update({
          is_correct: isCorrect,
          feedback,
        })
        .eq("id", answer.id);

      if (updateError) {
        console.error("Error updating answer:", updateError);
      }

      gradedAnswers.push({ answer_id: answer.id, is_correct: isCorrect });
    }

    // Calculate score
    const totalQuestions = answers.length;
    const scorePercentage = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;

    // Update attempt
    const { error: updateAttemptError } = await supabase
      .from("attempts")
      .update({
        finished_at: new Date().toISOString(),
        score_numeric: scorePercentage,
        details: {
          correct_count: correctCount,
          total_count: totalQuestions,
        },
      })
      .eq("id", attempt_id);

    if (updateAttemptError) {
      console.error("Error updating attempt:", updateAttemptError);
    }

    return new Response(
      JSON.stringify({
        attempt_id,
        score: scorePercentage,
        correct_count: correctCount,
        total_count: totalQuestions,
        message: "Grading completed",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error grading attempt:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function judgeShortAnswer(
  question: string,
  expectedAnswer: string,
  studentAnswer: string,
  apiKey: string
): Promise<{ correct: boolean; feedback: string }> {
  const prompt = `You are a fair and helpful teacher grading a short answer question.

Question: ${question}
Expected key points: ${expectedAnswer}
Student answer: ${studentAnswer}

Rules:
- Consider synonyms and paraphrases
- Ignore minor grammar/spelling errors
- Focus on whether key concepts are present
- Be encouraging but accurate

Return ONLY valid JSON:
{
  "correct": true/false,
  "feedback": "brief explanation (1-2 sentences)"
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
            content: "You are a fair and helpful teacher. Always return valid JSON.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.3,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No content in OpenAI response");
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);
    return {
      correct: parsed.correct === true,
      feedback: parsed.feedback || "Answer reviewed.",
    };
  } catch (error) {
    console.error("Error judging short answer:", error);
    // Fallback
    return {
      correct: false,
      feedback: "Unable to automatically grade. Please review manually.",
    };
  }
}

