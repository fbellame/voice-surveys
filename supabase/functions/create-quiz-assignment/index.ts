import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

interface CreateAssignmentRequest {
  quiz_id: string;
  assignment_type: "user" | "student_profile" | "community";
  user_id?: string;
  student_profile_id?: string;
  community_id?: string;
  due_date?: string;
  instructions?: string;
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
    console.log("Received request to create assignment");
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    
    // Get authenticated user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No authorization header");
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      console.error("User authentication error:", userError);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Authenticated user:", user.id);

    const body: CreateAssignmentRequest = await req.json();
    console.log("Request body:", JSON.stringify(body, null, 2));
    const { quiz_id, assignment_type, user_id, student_profile_id, community_id, due_date, instructions } = body;

    // Validate required fields
    if (!quiz_id || !assignment_type) {
      return new Response(
        JSON.stringify({ error: "quiz_id and assignment_type are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate assignment type matches provided IDs
    if (assignment_type === "user" && !user_id) {
      return new Response(
        JSON.stringify({ error: "user_id is required for user assignment" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (assignment_type === "student_profile" && !student_profile_id) {
      return new Response(
        JSON.stringify({ error: "student_profile_id is required for student_profile assignment" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (assignment_type === "community" && !community_id) {
      return new Response(
        JSON.stringify({ error: "community_id is required for community assignment" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user owns the quiz
    console.log("Querying quiz with id:", quiz_id);
    const { data: quiz, error: quizError } = await supabase
      .from("quizzes")
      .select("id, document_id")
      .eq("id", quiz_id)
      .single();

    console.log("Quiz query result:", { quiz, quizError });

    if (quizError || !quiz) {
      console.error("Quiz query error:", quizError);
      return new Response(
        JSON.stringify({ error: "Quiz not found", details: quizError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Quiz found, document_id:", quiz.document_id);

    // Verify user owns the document
    console.log("Querying document with id:", quiz.document_id);
    const { data: document, error: docError } = await supabase
      .from("documents")
      .select("id, user_id")
      .eq("id", quiz.document_id)
      .single();

    console.log("Document query result:", { document, docError });

    if (docError || !document) {
      console.error("Document query error:", docError);
      return new Response(
        JSON.stringify({ error: "Document not found", details: docError?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Document found, user_id:", document.user_id, "current user:", user.id);

    if (document.user_id !== user.id) {
      console.error("Permission denied: document user_id doesn't match current user");
      return new Response(
        JSON.stringify({ error: "You don't have permission to assign this quiz" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Permission check passed");

    // If community assignment, verify user owns the community
    if (assignment_type === "community") {
      console.log("Processing community assignment, community_id:", community_id);
      const { data: community, error: communityError } = await supabase
        .from("communities")
        .select("id, teacher_id")
        .eq("id", community_id)
        .single();

      console.log("Community query result:", { community, communityError });

      if (communityError || !community) {
        console.error("Community not found:", communityError);
        return new Response(
          JSON.stringify({ error: "Community not found", details: communityError?.message }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (community.teacher_id !== user.id) {
        console.error("Permission denied: community teacher_id doesn't match current user");
        return new Response(
          JSON.stringify({ error: "You don't have permission to assign to this community" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Community permission check passed");

      // Create assignments for all community members
      console.log("Fetching community members for community_id:", community_id);
      const { data: members, error: membersError } = await supabase
        .from("community_members")
        .select("user_id, student_profile_id, member_type")
        .eq("community_id", community_id);

      console.log("Members query result:", { members, membersError, memberCount: members?.length });

      if (membersError) {
        return new Response(
          JSON.stringify({ error: "Failed to fetch community members", details: membersError }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const assignments = [];
      for (const member of members || []) {
        assignments.push({
          quiz_id,
          assigned_by: user.id,
          assignment_type: member.member_type === "user" ? "user" : "student_profile",
          user_id: member.user_id || null,
          student_profile_id: member.student_profile_id || null,
          // Note: community_id must be NULL for individual assignments per database constraint
          // The community_id is only used when assignment_type = 'community'
          community_id: null,
          due_date: due_date || null,
          instructions: instructions || null,
        });
      }

      if (assignments.length === 0) {
        console.error("No assignments to create - community has no members");
        return new Response(
          JSON.stringify({ error: "Community has no members to assign the quiz to" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log("Creating", assignments.length, "assignments");
      console.log("Assignments data:", JSON.stringify(assignments, null, 2));
      const { data: createdAssignments, error: insertError } = await supabase
        .from("quiz_assignments")
        .insert(assignments)
        .select();

      console.log("Insert result:", { createdAssignments, insertError });

      if (insertError) {
        return new Response(
          JSON.stringify({ error: "Failed to create assignments", details: insertError }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          assignments: createdAssignments,
          count: createdAssignments?.length || 0,
          message: `Created ${createdAssignments?.length || 0} assignments for community`,
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    } else {
      // Single assignment
      const { data: assignment, error: insertError } = await supabase
        .from("quiz_assignments")
        .insert({
          quiz_id,
          assigned_by: user.id,
          assignment_type,
          user_id: assignment_type === "user" ? user_id : null,
          student_profile_id: assignment_type === "student_profile" ? student_profile_id : null,
          due_date: due_date || null,
          instructions: instructions || null,
        })
        .select()
        .single();

      if (insertError) {
        return new Response(
          JSON.stringify({ error: "Failed to create assignment", details: insertError }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          assignment,
          message: "Assignment created successfully",
        }),
        {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  } catch (error: any) {
    console.error("Error creating assignment:", error);
    console.error("Error stack:", error?.stack);
    console.error("Error details:", JSON.stringify(error, null, 2));
    return new Response(
      JSON.stringify({ 
        error: "Internal server error", 
        details: error?.message || String(error),
        type: error?.constructor?.name
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

