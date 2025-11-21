"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, ChevronRight, BookOpen, CheckCircle, Circle, Clock } from "lucide-react";

interface LessonPart {
  id: string;
  part_number: number;
  title: string;
  content: string;
  summary: string;
  learning_objectives: string[];
  key_concepts: string[];
  examples: string[];
}

interface Lesson {
  id: string;
  document_id: string;
  title: string;
  description: string | null;
  overview: string | null;
  estimated_duration_minutes: number;
  document?: {
    title: string;
  };
}

export default function LessonPage({ params }: { params: { id: string } }) {
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [parts, setParts] = useState<LessonPart[]>([]);
  const [currentPartIndex, setCurrentPartIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [completedParts, setCompletedParts] = useState<number[]>([]);
  const router = useRouter();

  useEffect(() => {
    loadLesson();
  }, [params.id]);

  const loadLesson = async () => {
    try {
      setLoading(true);
      
      // Load lesson with document
      const { data: lessonData, error: lessonError } = await supabase
        .from("document_lessons")
        .select(`
          *,
          document:documents(title)
        `)
        .eq("id", params.id)
        .single();

      if (lessonError) throw lessonError;
      setLesson(lessonData);

      // Load lesson parts
      const { data: partsData, error: partsError } = await supabase
        .from("lesson_parts")
        .select("*")
        .eq("lesson_id", params.id)
        .order("part_number", { ascending: true });

      if (partsError) throw partsError;
      setParts(partsData || []);

      // Load user progress
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: progressData } = await supabase
          .from("lesson_progress")
          .select("completed_parts, current_part_number")
          .eq("lesson_id", params.id)
          .eq("user_id", user.id)
          .maybeSingle();

        if (progressData) {
          setCompletedParts(progressData.completed_parts || []);
          setCurrentPartIndex((progressData.current_part_number || 1) - 1);
        }
      }
    } catch (error) {
      console.error("Error loading lesson:", error);
    } finally {
      setLoading(false);
    }
  };

  const markPartComplete = async (partNumber: number) => {
    if (completedParts.includes(partNumber)) return;

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const newCompletedParts = [...completedParts, partNumber];
    setCompletedParts(newCompletedParts);

    // Update progress in database
    const { data: existingProgress } = await supabase
      .from("lesson_progress")
      .select("id")
      .eq("lesson_id", params.id)
      .eq("user_id", user.id)
      .maybeSingle();

    if (existingProgress) {
      await supabase
        .from("lesson_progress")
        .update({
          completed_parts: newCompletedParts,
          current_part_number: Math.max(...newCompletedParts, currentPartIndex + 1),
          last_accessed_at: new Date().toISOString(),
        })
        .eq("id", existingProgress.id);
    } else {
      await supabase
        .from("lesson_progress")
        .insert({
          lesson_id: params.id,
          user_id: user.id,
          completed_parts: newCompletedParts,
          current_part_number: Math.max(...newCompletedParts, currentPartIndex + 1),
        });
    }
  };

  const goToPart = (index: number) => {
    if (index >= 0 && index < parts.length) {
      setCurrentPartIndex(index);
    }
  };

  const goToNextPart = () => {
    if (currentPartIndex < parts.length - 1) {
      const nextIndex = currentPartIndex + 1;
      goToPart(nextIndex);
      markPartComplete(parts[currentPartIndex].part_number);
    }
  };

  const goToPreviousPart = () => {
    if (currentPartIndex > 0) {
      goToPart(currentPartIndex - 1);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <p>Loading lesson...</p>
        </div>
      </div>
    );
  }

  if (!lesson || parts.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <p>Lesson not found</p>
          <Link href="/documents" className="text-blue-600 hover:underline">
            ← Back to Documents
          </Link>
        </div>
      </div>
    );
  }

  const currentPart = parts[currentPartIndex];
  const isLastPart = currentPartIndex === parts.length - 1;
  const isFirstPart = currentPartIndex === 0;
  const progressPercentage = ((currentPartIndex + 1) / parts.length) * 100;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <div className="mb-6">
          <Link 
            href={`/documents/${lesson.document_id}`}
            className="text-blue-600 hover:underline mb-4 inline-block flex items-center gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Document
          </Link>
          <h1 className="text-3xl font-bold mb-2">{lesson.title}</h1>
          {lesson.document && (
            <p className="text-gray-600 mb-4">
              From: {lesson.document.title}
            </p>
          )}
          {lesson.overview && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h2 className="font-semibold text-blue-900 mb-2">Lesson Overview</h2>
              <p className="text-blue-800">{lesson.overview}</p>
            </div>
          )}
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>~{lesson.estimated_duration_minutes} minutes</span>
            </div>
            <div className="flex items-center gap-1">
              <BookOpen className="h-4 w-4" />
              <span>{parts.length} parts</span>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Progress: Part {currentPartIndex + 1} of {parts.length}
            </span>
            <span className="text-sm text-gray-600">
              {Math.round(progressPercentage)}% Complete
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Parts Navigation */}
        <div className="mb-6 flex gap-2 overflow-x-auto pb-2">
          {parts.map((part, index) => {
            const isCompleted = completedParts.includes(part.part_number);
            const isCurrent = index === currentPartIndex;
            return (
              <button
                key={part.id}
                onClick={() => goToPart(index)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all whitespace-nowrap ${
                  isCurrent
                    ? "border-blue-600 bg-blue-50 text-blue-900"
                    : isCompleted
                    ? "border-green-500 bg-green-50 text-green-900"
                    : "border-gray-300 bg-white text-gray-700 hover:border-gray-400"
                }`}
              >
                {isCompleted ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <Circle className="h-4 w-4" />
                )}
                <span className="font-medium">Part {part.part_number}</span>
                <span className="text-xs opacity-75">{part.title}</span>
              </button>
            );
          })}
        </div>

        {/* Current Part Content */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">
                Part {currentPart.part_number}: {currentPart.title}
              </h2>
              {!completedParts.includes(currentPart.part_number) && (
                <button
                  onClick={() => markPartComplete(currentPart.part_number)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  Mark Complete
                </button>
              )}
            </div>
          </div>

          {/* Learning Objectives */}
          {currentPart.learning_objectives && currentPart.learning_objectives.length > 0 && (
            <div className="mb-6 bg-purple-50 border border-purple-200 rounded-lg p-4">
              <h3 className="font-semibold text-purple-900 mb-2">Learning Objectives</h3>
              <ul className="list-disc list-inside space-y-1 text-purple-800">
                {currentPart.learning_objectives.map((objective, idx) => (
                  <li key={idx}>{objective}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Main Content */}
          <div className="mb-6 prose max-w-none">
            <div className="text-gray-700 leading-relaxed whitespace-pre-line">
              {currentPart.content}
            </div>
          </div>

          {/* Key Concepts */}
          {currentPart.key_concepts && currentPart.key_concepts.length > 0 && (
            <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h3 className="font-semibold text-yellow-900 mb-2">Key Concepts</h3>
              <div className="flex flex-wrap gap-2">
                {currentPart.key_concepts.map((concept, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm"
                  >
                    {concept}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Examples */}
          {currentPart.examples && currentPart.examples.length > 0 && (
            <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <h3 className="font-semibold text-green-900 mb-2">Examples</h3>
              <ul className="space-y-2 text-green-800">
                {currentPart.examples.map((example, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="font-semibold">{idx + 1}.</span>
                    <span>{example}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Summary */}
          {currentPart.summary && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <h3 className="font-semibold text-gray-900 mb-2">Summary</h3>
              <p className="text-gray-700">{currentPart.summary}</p>
            </div>
          )}
        </div>

        {/* Navigation Buttons */}
        <div className="flex justify-between items-center">
          <button
            onClick={goToPreviousPart}
            disabled={isFirstPart}
            className={`flex items-center gap-2 px-6 py-3 rounded-lg transition ${
              isFirstPart
                ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                : "bg-gray-600 text-white hover:bg-gray-700"
            }`}
          >
            <ChevronLeft className="h-5 w-5" />
            Previous Part
          </button>

          {isLastPart ? (
            <div className="flex gap-4">
              <Link
                href={`/documents/${lesson.document_id}`}
                className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition"
              >
                Back to Document
              </Link>
              <button
                onClick={() => {
                  markPartComplete(currentPart.part_number);
                  // Could navigate to quiz generation or quiz page here
                }}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
              >
                Ready for Quiz
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                markPartComplete(currentPart.part_number);
                goToNextPart();
              }}
              className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Next Part
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

