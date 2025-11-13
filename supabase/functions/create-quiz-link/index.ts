import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface CreateQuizLinkRequest {
  quiz_id: string;
  name?: string;
  max_attempts?: number;
  expires_at?: string;
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
    
    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: CreateQuizLinkRequest = await req.json();
    const { quiz_id, name, max_attempts, expires_at } = body;

    if (!quiz_id) {
      return new Response(
        JSON.stringify({ error: "quiz_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user owns the quiz
    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .select(`
        id,
        document:documents!inner(user_id)
      `)
      .eq("id", quiz_id)
      .single();

    if (quizError || !quiz) {
      return new Response(
        JSON.stringify({ error: "Quiz not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (quiz.document.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "You don't have permission to create links for this quiz" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate unique token
    const tokenBytes = new Uint8Array(32);
    crypto.getRandomValues(tokenBytes);
    const uniqueToken = btoa(String.fromCharCode(...tokenBytes))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=/g, "");

    // Create quiz link
    const { data: quizLink, error: insertError } = await supabase
      .from("quiz_links")
      .insert({
        quiz_id,
        unique_token: uniqueToken,
        name: name || null,
        max_attempts: max_attempts || null,
        expires_at: expires_at || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      return new Response(
        JSON.stringify({ error: "Failed to create quiz link", details: insertError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Construct the shareable URL (assuming frontend route is /quiz/[token])
    const shareableUrl = `${SUPABASE_URL.replace("/rest/v1", "")}/quiz/${uniqueToken}`;

    return new Response(
      JSON.stringify({
        success: true,
        quiz_link: quizLink,
        shareable_url: shareableUrl,
        message: "Quiz link created successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error creating quiz link:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

