"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface Community {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  member_count?: number;
}

export default function CommunitiesPage() {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newCommunityName, setNewCommunityName] = useState("");
  const [newCommunityDescription, setNewCommunityDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadCommunities();
  }, []);

  const loadCommunities = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      // Load communities with member counts
      const { data, error } = await supabase
        .from("communities")
        .select(`
          id,
          name,
          description,
          created_at,
          community_members(count)
        `)
        .eq("teacher_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Transform data to include member count
      const communitiesWithCounts = (data || []).map((comm: any) => ({
        ...comm,
        member_count: comm.community_members?.[0]?.count || 0,
      }));

      setCommunities(communitiesWithCounts);
    } catch (error) {
      console.error("Error loading communities:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCommunity = async () => {
    setError(null);
    
    if (!newCommunityName.trim()) {
      setError("Please enter a community name");
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
        .from("communities")
        .insert({
          name: newCommunityName.trim(),
          description: newCommunityDescription.trim() || null,
          teacher_id: user.id,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      setShowCreateModal(false);
      setNewCommunityName("");
      setNewCommunityDescription("");
      setError(null);
      loadCommunities();
    } catch (error: any) {
      console.error("Error creating community:", error);
      setError(`Failed to create community: ${error.message}`);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <p>Loading communities...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-6xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">My Communities</h1>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            + Create Community
          </button>
        </div>

        {communities.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 mb-4">No communities yet.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="text-blue-600 hover:underline"
            >
              Create your first community
            </button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {communities.map((community) => (
              <Link
                key={community.id}
                href={`/communities/${community.id}`}
                className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition"
              >
                <h2 className="text-xl font-semibold mb-2">{community.name}</h2>
                {community.description && (
                  <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                    {community.description}
                  </p>
                )}
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>{community.member_count || 0} members</span>
                  <span>{new Date(community.created_at).toLocaleDateString()}</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Create Community Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-2xl font-bold mb-4">Create Community</h2>
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
                    value={newCommunityName}
                    onChange={(e) => setNewCommunityName(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., Math 101, Science Class"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Description
                  </label>
                  <textarea
                    value={newCommunityDescription}
                    onChange={(e) => setNewCommunityDescription(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    rows={3}
                    placeholder="Optional description..."
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setShowCreateModal(false);
                      setNewCommunityName("");
                      setNewCommunityDescription("");
                      setError(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    disabled={creating}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCreateCommunity}
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

