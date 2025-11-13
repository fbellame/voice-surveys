"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Assignment {
  id: string;
  quiz_id: string;
  assignment_type: string;
  due_date: string | null;
  instructions: string | null;
  created_at: string;
  quiz: {
    id: string;
    title: string;
  };
  community?: {
    id: string;
    name: string;
  };
}

export default function MyAssignmentsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    loadAssignments();
  }, []);

  const loadAssignments = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      // Load assignments for this user
      const { data, error } = await supabase
        .from("quiz_assignments")
        .select(`
          id,
          quiz_id,
          assignment_type,
          due_date,
          instructions,
          created_at,
          quiz:quizzes(id, title),
          community:communities(id, name)
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error("Error loading assignments:", error);
    } finally {
      setLoading(false);
    }
  };

  const [attemptStatuses, setAttemptStatuses] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (assignments.length > 0) {
      checkAttemptStatuses();
    }
  }, [assignments]);

  const checkAttemptStatuses = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) return;

      const quizIds = assignments.map((a) => a.quiz_id);
      const { data, error } = await supabase
        .from("attempts")
        .select("quiz_id")
        .eq("user_id", user.id)
        .in("quiz_id", quizIds);

      if (error) return;

      const statuses: Record<string, boolean> = {};
      quizIds.forEach((quizId) => {
        statuses[quizId] = (data || []).some((a) => a.quiz_id === quizId);
      });

      setAttemptStatuses(statuses);
    } catch (error) {
      console.error("Error checking attempt statuses:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <p>Loading assignments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold mb-8">My Quiz Assignments</h1>

        {assignments.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600">No assignments yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {assignments.map((assignment) => {
              const hasAttempt = attemptStatuses[assignment.quiz_id] || false;
              return (
                <div
                  key={assignment.id}
                  className="bg-white rounded-lg shadow p-6"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h2 className="text-xl font-semibold mb-2">
                        {assignment.quiz.title}
                      </h2>
                      {assignment.community && (
                        <p className="text-sm text-gray-600 mb-2">
                          From: {assignment.community.name}
                        </p>
                      )}
                      {assignment.due_date && (
                        <p className="text-sm text-gray-600 mb-2">
                          Due: {new Date(assignment.due_date).toLocaleString()}
                        </p>
                      )}
                      {assignment.instructions && (
                        <p className="text-sm text-gray-700 mb-2">
                          {assignment.instructions}
                        </p>
                      )}
                      <p className="text-xs text-gray-500">
                        Assigned: {new Date(assignment.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div>
                      {hasAttempt ? (
                        <span className="px-3 py-1 bg-green-100 text-green-800 rounded text-sm">
                          Completed
                        </span>
                      ) : (
                        <Link
                          href={`/quizzes/${assignment.quiz_id}`}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                          Take Quiz
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

