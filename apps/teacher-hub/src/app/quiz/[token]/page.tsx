"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Question {
  id: string;
  type: "mcq" | "true_false" | "short_answer" | "cloze";
  prompt: string;
  options?: string[];
  correct_answer: any;
  rationale?: string;
}

interface QuizLink {
  id: string;
  quiz_id: string;
  name: string | null;
  is_active: boolean;
  max_attempts: number | null;
  expires_at: string | null;
  quiz: {
    id: string;
    title: string;
  };
}

export default function AnonymousQuizPage({ params }: { params: { token: string } }) {
  const [quizLink, setQuizLink] = useState<QuizLink | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadQuizLink();
  }, [params.token]);

  const loadQuizLink = async () => {
    try {
      // Load quiz link
      const { data: linkData, error: linkError } = await supabase
        .from("quiz_links")
        .select(`
          id,
          quiz_id,
          name,
          is_active,
          max_attempts,
          expires_at,
          quiz:quizzes(id, title, questions:questions(id, type, prompt, options, correct_answer, rationale))
        `)
        .eq("unique_token", params.token)
        .single();

      if (linkError || !linkData) {
        setError("Quiz link not found or invalid");
        setLoading(false);
        return;
      }

      // Check if link is active
      if (!linkData.is_active) {
        setError("This quiz link is no longer active");
        setLoading(false);
        return;
      }

      // Check if link has expired
      if (linkData.expires_at && new Date(linkData.expires_at) < new Date()) {
        setError("This quiz link has expired");
        setLoading(false);
        return;
      }

      setQuizLink(linkData);
      setQuestions(linkData.quiz.questions || []);
    } catch (error) {
      console.error("Error loading quiz link:", error);
      setError("Failed to load quiz");
    } finally {
      setLoading(false);
    }
  };

  const handleAnswerChange = (questionId: string, value: any) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: value,
    }));
  };

  const handleSubmit = async () => {
    if (Object.keys(answers).length !== questions.length) {
      alert("Please answer all questions");
      return;
    }

    if (!quizLink) return;

    setSubmitting(true);

    try {
      // Create anonymous attempt (user_id can be NULL for anonymous)
      const { data: attempt, error: attemptError } = await supabase
        .from("attempts")
        .insert({
          quiz_id: quizLink.quiz_id,
          user_id: null, // NULL for anonymous attempts
          link_token: params.token,
          is_anonymous: true,
        })
        .select()
        .single();

      if (attemptError) throw attemptError;

      // Create answers
      const answerInserts = Object.entries(answers).map(([questionId, userAnswer]) => ({
        attempt_id: attempt.id,
        question_id: questionId,
        user_answer: userAnswer,
      }));

      const { error: answersError } = await supabase
        .from("answers")
        .insert(answerInserts);

      if (answersError) throw answersError;

      // Grade the attempt
      await supabase.functions.invoke("grade", {
        body: { attempt_id: attempt.id },
      });

      router.push(`/attempts/${attempt.id}`);
    } catch (error) {
      console.error("Error submitting quiz:", error);
      alert("Failed to submit quiz");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <p>Loading quiz...</p>
        </div>
      </div>
    );
  }

  if (error || !quizLink) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h1 className="text-2xl font-bold mb-4">Error</h1>
            <p className="text-gray-600">{error || "Quiz not found"}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <p className="text-blue-800">
            You are taking this quiz anonymously via a shareable link.
          </p>
        </div>

        <h1 className="text-3xl font-bold mb-8">{quizLink.quiz.title}</h1>

        <div className="space-y-6">
          {questions.map((question, index) => (
            <div key={question.id} className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold mb-4">
                Question {index + 1}: {question.prompt}
              </h3>

              {question.type === "mcq" && question.options && (
                <div className="space-y-2">
                  {question.options.map((option, optIndex) => (
                    <label
                      key={optIndex}
                      className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-gray-50 rounded"
                    >
                      <input
                        type="radio"
                        name={question.id}
                        value={optIndex}
                        checked={answers[question.id] === optIndex}
                        onChange={(e) =>
                          handleAnswerChange(question.id, parseInt(e.target.value))
                        }
                        className="w-4 h-4"
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              )}

              {question.type === "true_false" && (
                <div className="space-y-2">
                  <label className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                    <input
                      type="radio"
                      name={question.id}
                      value="true"
                      checked={answers[question.id] === true}
                      onChange={() => handleAnswerChange(question.id, true)}
                      className="w-4 h-4"
                    />
                    <span>True</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                    <input
                      type="radio"
                      name={question.id}
                      value="false"
                      checked={answers[question.id] === false}
                      onChange={() => handleAnswerChange(question.id, false)}
                      className="w-4 h-4"
                    />
                    <span>False</span>
                  </label>
                </div>
              )}

              {question.type === "short_answer" && (
                <textarea
                  value={answers[question.id] || ""}
                  onChange={(e) => handleAnswerChange(question.id, e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={3}
                  placeholder="Enter your answer..."
                />
              )}
            </div>
          ))}
        </div>

        <div className="mt-8 flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={submitting || Object.keys(answers).length !== questions.length}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {submitting ? "Submitting..." : "Submit Quiz"}
          </button>
        </div>
      </div>
    </div>
  );
}

