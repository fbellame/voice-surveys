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

export default function QuizPage({ params }: { params: { id: string } }) {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [quizTitle, setQuizTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadQuiz();
  }, [params.id]);

  const loadQuiz = async () => {
    try {
      const { data, error } = await supabase
        .from("quizzes")
        .select(`
          id,
          title,
          questions:questions(id, type, prompt, options, correct_answer, rationale)
        `)
        .eq("id", params.id)
        .single();

      if (error) throw error;

      setQuizTitle(data.title);
      setQuestions(data.questions || []);
    } catch (error) {
      console.error("Error loading quiz:", error);
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

    setSubmitting(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        alert("Please sign in");
        return;
      }

      // Create attempt
      const { data: attempt, error: attemptError } = await supabase
        .from("attempts")
        .insert({
          quiz_id: params.id,
          user_id: user.id,
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

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <Link href="/quizzes" className="text-blue-600 hover:underline mb-4 inline-block">
          ← Back to Quizzes
        </Link>
        <h1 className="text-3xl font-bold mb-8">{quizTitle}</h1>

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

