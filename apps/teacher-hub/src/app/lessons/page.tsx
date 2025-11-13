"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Lesson {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}

export default function LessonsPage() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newLessonName, setNewLessonName] = useState("");
  const [newLessonDescription, setNewLessonDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadLessons();
  }, []);

  const loadLessons = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("lesson")
        .select("id, name, description, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setLessons(data || []);
    } catch (error) {
      console.error("Error loading lessons:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateLesson = async () => {
    setError(null);
    
    if (!newLessonName.trim()) {
      setError("Please enter a lesson name");
      return;
    }

    setCreating(true);

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Please sign in");
        setCreating(false);
        return;
      }

      const { data, error: insertError } = await supabase
        .from("lesson")
        .insert({
          name: newLessonName.trim(),
          description: newLessonDescription.trim() || null,
          user_id: user.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setShowCreateModal(false);
      setNewLessonName("");
      setNewLessonDescription("");
      setError(null);
      loadLessons();
    } catch (error: any) {
      console.error("Error creating lesson:", error);
      setError(`Failed to create lesson: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <p>Loading lessons...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">My Lessons</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            + Create Lesson
          </button>
        </div>

        {lessons.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 mb-4">No lessons yet.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-blue-600 hover:underline"
            >
              Create your first lesson
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {lessons.map((lesson) => (
              <div
                key={lesson.id}
                className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition"
              >
                <h2 className="text-xl font-semibold mb-2">{lesson.name}</h2>
                {lesson.description && (
                  <p className="text-sm text-gray-600 mb-2">{lesson.description}</p>
                )}
                <p className="text-xs text-gray-500">
                  Created: {new Date(lesson.created_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Create Lesson Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold mb-4">Create Lesson</h2>
              {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={newLessonName}
                    onChange={(e) => {
                      setNewLessonName(e.target.value);
                      setError(null);
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Introduction to Math"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={newLessonDescription}
                    onChange={(e) => setNewLessonDescription(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Optional description..."
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setNewLessonName("");
                      setNewLessonDescription("");
                      setError(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    disabled={creating}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateLesson}
                    disabled={creating}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {creating ? "Creating..." : "Create"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

