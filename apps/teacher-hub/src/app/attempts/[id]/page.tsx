"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

interface Answer {
  id: string;
  user_answer: any;
  is_correct: boolean;
  feedback?: string;
  question: {
    id: string;
    prompt: string;
    type: string;
    options?: string[];
    correct_answer: any;
    rationale?: string;
  };
}

export default function AttemptPage({ params }: { params: { id: string } }) {
  const [attempt, setAttempt] = useState<any>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAttempt();
  }, [params.id]);

  const loadAttempt = async () => {
    try {
      const { data, error } = await supabase
        .from("attempts")
        .select(`
          *,
          answers(*, question:questions(*))
        `)
        .eq("id", params.id)
        .single();

      if (error) throw error;

      setAttempt(data);
      setAnswers(data.answers || []);
    } catch (error) {
      console.error("Error loading attempt:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <p>Loading results...</p>
        </div>
      </div>
    );
  }

  // Calculate actual correctness for each answer (handles stale database values)
  const calculateIsCorrect = (answer: Answer): boolean => {
    const question = answer.question;
    const userAnswer = answer.user_answer;
    const correctAnswer = question.correct_answer;

    if (question.type === "mcq" || question.type === "true_false") {
      if (typeof correctAnswer === "boolean") {
        return userAnswer === correctAnswer;
      } else if (typeof correctAnswer === "number") {
        return userAnswer === correctAnswer;
      } else {
        // Handle case where userAnswer is an index (number) and correctAnswer is option text (string)
        if (typeof userAnswer === "number" && question.options && Array.isArray(question.options)) {
          const userOptionText = question.options[userAnswer];
          if (userOptionText !== undefined) {
            return String(userOptionText).toLowerCase().trim() === String(correctAnswer).toLowerCase().trim();
          }
        }
        // Fallback to string comparison
        return String(userAnswer).toLowerCase().trim() === String(correctAnswer).toLowerCase().trim();
      }
    }
    
    // For other question types, use the database value
    return answer.is_correct;
  };

  const answersWithCorrectness = answers.map(a => ({ ...a, calculatedIsCorrect: calculateIsCorrect(a) }));
  const correctCount = answersWithCorrectness.filter((a) => a.calculatedIsCorrect).length;
  const totalCount = answers.length;
  // Recalculate score based on actual correctness (not stale database value)
  const calculatedScore = totalCount > 0 ? (correctCount / totalCount) * 100 : 0;

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <Link href="/quizzes" className="text-blue-600 hover:underline mb-4 inline-block">
          ← Back to Quizzes
        </Link>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-3xl font-bold mb-4">Quiz Results</h1>
          <div className="flex items-center space-x-8">
            <div>
              <p className="text-2xl font-bold text-blue-600">{calculatedScore.toFixed(1)}%</p>
              <p className="text-sm text-gray-600">Score</p>
            </div>
            <div>
              <p className="text-2xl font-bold">
                {correctCount} / {totalCount}
              </p>
              <p className="text-sm text-gray-600">Correct</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {answersWithCorrectness.map((answer, index) => (
            <div
              key={answer.id}
              className={`bg-white rounded-lg shadow p-6 ${
                answer.calculatedIsCorrect ? "border-l-4 border-green-500" : "border-l-4 border-red-500"
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <h3 className="text-lg font-semibold">
                  Question {index + 1}: {answer.question.prompt}
                </h3>
                <span
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    answer.calculatedIsCorrect
                      ? "bg-green-100 text-green-800"
                      : "bg-red-100 text-red-800"
                  }`}
                >
                  {answer.calculatedIsCorrect ? "Correct" : "Incorrect"}
                </span>
              </div>

              {answer.question.type === "mcq" && answer.question.options && (
                <div className="space-y-2 mb-4">
                  {answer.question.options.map((option: string, optIndex: number) => {
                    const isUserAnswer = answer.user_answer === optIndex;
                    // Handle both cases: correct_answer can be an index (number) or option text (string)
                    const correctAnswer = answer.question.correct_answer;
                    const isCorrect = 
                      typeof correctAnswer === "number" 
                        ? correctAnswer === optIndex
                        : String(correctAnswer).toLowerCase().trim() === option.toLowerCase().trim();
                    return (
                      <div
                        key={optIndex}
                        className={`p-2 rounded ${
                          isCorrect
                            ? "bg-green-50 border border-green-200"
                            : isUserAnswer && !isCorrect
                            ? "bg-red-50 border border-red-200"
                            : "bg-gray-50"
                        }`}
                      >
                        {option}
                        {isCorrect && <span className="ml-2 text-green-600">✓ Correct</span>}
                        {isUserAnswer && !isCorrect && (
                          <span className="ml-2 text-red-600">✗ Your answer</span>
                        )}
                        {isUserAnswer && isCorrect && (
                          <span className="ml-2 text-green-600">✓ Your answer</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {answer.question.type === "true_false" && (
                <div className="mb-4">
                  <p className="text-gray-700">
                    Your answer: <strong>{answer.user_answer ? "True" : "False"}</strong>
                  </p>
                  <p className="text-gray-700">
                    Correct answer: <strong>{answer.question.correct_answer ? "True" : "False"}</strong>
                  </p>
                </div>
              )}

              {answer.question.type === "short_answer" && (
                <div className="mb-4">
                  <p className="text-gray-700 mb-2">
                    <strong>Your answer:</strong> {answer.user_answer}
                  </p>
                  <p className="text-gray-700">
                    <strong>Expected:</strong> {answer.question.correct_answer}
                  </p>
                </div>
              )}

              {(answer.feedback || answer.calculatedIsCorrect) && (
                <div className={`mt-4 p-3 rounded ${
                  answer.calculatedIsCorrect ? "bg-green-50" : "bg-blue-50"
                }`}>
                  <p className={`text-sm ${
                    answer.calculatedIsCorrect ? "text-green-900" : "text-blue-900"
                  }`}>
                    {answer.calculatedIsCorrect 
                      ? `Correct! ${answer.question.rationale ? answer.question.rationale : "Well done!"}`.trim()
                      : answer.feedback || `Incorrect. The correct answer is: ${answer.question.correct_answer}.`
                    }
                  </p>
                </div>
              )}

              {answer.question.rationale && !answer.calculatedIsCorrect && (
                <div className="mt-2 p-3 bg-gray-50 rounded">
                  <p className="text-sm text-gray-700">
                    <strong>Explanation:</strong> {answer.question.rationale}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

