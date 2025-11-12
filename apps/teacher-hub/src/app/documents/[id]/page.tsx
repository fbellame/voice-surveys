"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function DocumentPage({ params }: { params: { id: string } }) {
  const [document, setDocument] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const router = useRouter();

  useEffect(() => {
    loadDocument();
  }, [params.id]);

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
        router.push(`/quizzes/${data.quiz_id}`);
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
          <button
            onClick={handleGenerateQuiz}
            disabled={generating}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {generating ? "Generating Quiz..." : "Generate Quiz"}
          </button>
        </div>
      </div>
    </div>
  );
}

