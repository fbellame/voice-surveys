"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

interface Quiz {
  id: string;
  title: string;
  created_at: string;
  document: {
    title: string;
  };
}

export default function QuizzesPage() {
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuizzes();
  }, []);

  const loadQuizzes = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("quizzes")
        .select(`
          id,
          title,
          created_at,
          document:documents(title)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;

      setQuizzes(data || []);
    } catch (error) {
      console.error("Error loading quizzes:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <p>Loading quizzes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">My Quizzes</h1>
          <Link
            href="/upload"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Upload New PDF
          </Link>
        </div>

        {quizzes.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 mb-4">No quizzes yet.</p>
            <Link
              href="/upload"
              className="text-blue-600 hover:underline"
            >
              Upload a PDF to get started
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {quizzes.map((quiz) => (
              <Link
                key={quiz.id}
                href={`/quizzes/${quiz.id}`}
                className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition"
              >
                <h2 className="text-xl font-semibold mb-2">{quiz.title}</h2>
                <p className="text-sm text-gray-600 mb-2">
                  From: {quiz.document?.title || "Unknown document"}
                </p>
                <p className="text-xs text-gray-500">
                  Created: {new Date(quiz.created_at).toLocaleDateString()}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

