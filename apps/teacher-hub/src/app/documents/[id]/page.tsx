"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function DocumentPage({ params }: { params: { id: string } }) {
  const [document, setDocument] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [generatingLesson, setGeneratingLesson] = useState(false);
  const [lessons, setLessons] = useState<any[]>([]);
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [selectedQuizId, setSelectedQuizId] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadDocument();
    loadLessons();
    loadQuizzes();
  }, [params.id]);

  // Auto-select first quiz when quizzes load
  useEffect(() => {
    if (quizzes.length > 0 && !selectedQuizId) {
      setSelectedQuizId(quizzes[0].id);
    }
  }, [quizzes, selectedQuizId]);

  const loadDocument = async () => {
    try {
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .eq("id", params.id)
        .single();

      if (error) throw error;
      setDocument(data);
    } catch (error) {
      console.error("Error loading document:", error);
    }
  };

  const loadLessons = async () => {
    try {
      const { data, error } = await supabase
        .from("document_lessons")
        .select("*")
        .eq("document_id", params.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLessons(data || []);
    } catch (error) {
      console.error("Error loading lessons:", error);
    }
  };

  const loadQuizzes = async () => {
    try {
      const { data, error } = await supabase
        .from("quizzes")
        .select("*")
        .eq("document_id", params.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setQuizzes(data || []);
    } catch (error) {
      console.error("Error loading quizzes:", error);
    }
  };

  const handleGenerateQuiz = async () => {
    setGenerating(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-quiz", {
        body: {
          document_id: params.id,
          target_count: 15,
          types: ["mcq", "true_false", "short_answer"],
        },
      });

      if (error) {
        console.error("Error generating quiz:", error);
        alert(`Failed to generate quiz: ${error.message || "Unknown error"}`);
        return;
      }

      if (data?.error) {
        console.error("Quiz generation error:", data.error);
        alert(`Failed to generate quiz: ${data.error}. ${data.details || ""}`);
        return;
      }

      if (data?.quiz_id) {
        // Reload quizzes and select the new quiz
        await loadQuizzes();
        setSelectedQuizId(data.quiz_id);
        // Optionally navigate to quiz or stay on page
        // router.push(`/quizzes/${data.quiz_id}`);
      } else {
        alert("Quiz generated but no quiz_id returned. Please check the console.");
      }
    } catch (error: any) {
      console.error("Error generating quiz:", error);
      alert(`Failed to generate quiz: ${error.message || "Unknown error"}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateLesson = async () => {
    if (!selectedQuizId) {
      alert("Please generate a quiz first, or select an existing quiz to create a lesson for.");
      return;
    }

    setGeneratingLesson(true);

    try {
      const { data, error } = await supabase.functions.invoke("generate-lesson", {
        body: {
          quiz_id: selectedQuizId,
        },
      });

      if (error) {
        console.error("Error generating lesson:", error);
        alert(`Failed to generate lesson: ${error.message || "Unknown error"}`);
        return;
      }

      if (data?.error) {
        console.error("Lesson generation error:", data.error);
        alert(`Failed to generate lesson: ${data.error}. ${data.details || ""}`);
        return;
      }

      if (data?.lesson_id) {
        // Reload lessons and navigate to the new lesson
        await loadLessons();
        router.push(`/lessons/${data.lesson_id}`);
      } else {
        alert("Lesson generated but no lesson_id returned. Please check the console.");
      }
    } catch (error: any) {
      console.error("Error generating lesson:", error);
      alert(`Failed to generate lesson: ${error.message || "Unknown error"}`);
    } finally {
      setGeneratingLesson(false);
    }
  };

  if (!document) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <p>Loading document...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <Link href="/upload" className="text-blue-600 hover:underline mb-4 inline-block">
          ← Back to Upload
        </Link>
        <h1 className="text-3xl font-bold mb-8">{document.title}</h1>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <p className="text-gray-600 mb-4">
            Pages: {document.pages} | Created: {new Date(document.created_at).toLocaleDateString()}
          </p>
          
          {/* Quiz Selection */}
          {quizzes.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Quiz for Lesson Generation:
              </label>
              <select
                value={selectedQuizId || ""}
                onChange={(e) => setSelectedQuizId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-2"
              >
                {quizzes.map((quiz) => (
                  <option key={quiz.id} value={quiz.id}>
                    {quiz.title}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500">
                Lessons are generated based on quiz content to help you prepare for the quiz.
              </p>
            </div>
          )}

          <div className="flex gap-4">
            <button
              onClick={handleGenerateQuiz}
              disabled={generating}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              {generating ? "Generating Quiz..." : "Generate Quiz"}
            </button>
            <button
              onClick={handleGenerateLesson}
              disabled={generatingLesson || !selectedQuizId}
              className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              title={!selectedQuizId ? "Please generate a quiz first" : ""}
            >
              {generatingLesson ? "Generating Lesson..." : "Generate Learning Lesson"}
            </button>
          </div>
          
          {quizzes.length === 0 && (
            <p className="text-sm text-amber-600 mt-3">
              ⚠️ Generate a quiz first. Lessons are created based on quiz content to help you prepare.
            </p>
          )}
        </div>

        {/* Existing Quizzes */}
        {quizzes.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Quizzes</h2>
            <div className="space-y-3">
              {quizzes.map((quiz) => (
                <div
                  key={quiz.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                >
                  <div>
                    <h3 className="font-semibold text-lg">{quiz.title}</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Created: {new Date(quiz.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/quizzes/${quiz.id}`}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                      View Quiz
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Existing Lessons */}
        {lessons.length > 0 && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold mb-4">Learning Lessons</h2>
            <div className="space-y-3">
              {lessons.map((lesson) => (
                <div
                  key={lesson.id}
                  className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
                >
                  <div>
                    <h3 className="font-semibold text-lg">{lesson.title}</h3>
                    {lesson.overview && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {lesson.overview}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-2">
                      ~{lesson.estimated_duration_minutes} minutes
                    </p>
                  </div>
                  <Link
                    href={`/lessons/${lesson.id}`}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                  >
                    View Lesson
                  </Link>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

