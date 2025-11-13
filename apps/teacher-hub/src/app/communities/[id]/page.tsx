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
}

interface Member {
  id: string;
  member_type: "user" | "student_profile";
  user_id: string | null;
  student_profile_id: string | null;
  role: string;
  joined_at: string;
  user?: {
    email: string;
  };
  student_profile?: {
    full_name: string | null;
    email: string | null;
  };
}

export default function CommunityPage({ params }: { params: { id: string } }) {
  const [community, setCommunity] = useState<Community | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [memberType, setMemberType] = useState<"user" | "student_profile">("user");
  const [userEmail, setUserEmail] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentEmail, setStudentEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    loadCommunity();
    loadMembers();
  }, [params.id]);

  const loadCommunity = async () => {
    try {
      const { data, error } = await supabase
        .from("communities")
        .select("*")
        .eq("id", params.id)
        .single();

      if (error) throw error;
      setCommunity(data);
    } catch (error) {
      console.error("Error loading community:", error);
    }
  };

  const loadMembers = async () => {
    try {
      const { data, error } = await supabase
        .from("community_members")
        .select(`
          id,
          member_type,
          user_id,
          student_profile_id,
          role,
          joined_at,
          student_profile:student_profiles(full_name, email)
        `)
        .eq("community_id", params.id)
        .order("joined_at", { ascending: false });

      if (error) throw error;
      
      // For user members, we need to fetch user data separately since we can't directly query auth.users
      const membersWithData = await Promise.all((data || []).map(async (member: any) => {
        if (member.member_type === "user" && member.user_id) {
          // Try to get user email from a user_profiles table if it exists, or leave it null
          // For now, we'll just show the user_id
          return {
            ...member,
            user: { email: member.user_id }, // Placeholder - would need edge function for real email
          };
        }
        return member;
      }));
      
      setMembers(membersWithData);
    } catch (error) {
      console.error("Error loading members:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async () => {
    setError(null);
    setSuccess(null);
    
    if (memberType === "user" && !userEmail.trim()) {
      setError("Please enter a user email");
      return;
    }

    if (memberType === "student_profile" && !studentName.trim()) {
      setError("Please enter a student name");
      return;
    }

    setAdding(true);

    try {
      if (memberType === "user") {
        // Note: User lookup requires admin access to auth.users
        // For now, we'll use an edge function or require the user to be already in the system
        // This is a simplified version - in production, you'd want an edge function
        // that uses service role key to look up users by email
        
        // Try to get the current user's session to verify they're authenticated
        const { data: { user: currentUser } } = await supabase.auth.getUser();
        
        if (!currentUser) {
          setError("Please sign in to add users");
          setAdding(false);
          return;
        }

        // For now, we'll create a note that user lookup needs to be implemented
        // via edge function. For demo purposes, we'll show an error.
        setError("User lookup by email requires an edge function with admin access. Please use student profiles for now, or implement user lookup via edge function.");
        setAdding(false);
        return;
        
        // TODO: Implement via edge function:
        // const { data, error } = await supabase.functions.invoke("lookup-user-by-email", {
        //   body: { email: userEmail.trim() }
        // });
      } else {
        // Create or find student profile
        let studentProfileId: string;

        // Check if student profile exists
        const { data: existingProfile } = await supabase
          .from("student_profiles")
          .select("id")
          .eq("email", studentEmail.trim() || null)
          .single();

        if (existingProfile) {
          studentProfileId = existingProfile.id;
        } else {
          // Create new student profile
          const { data: newProfile, error: createError } = await supabase
            .from("student_profiles")
            .insert({
              full_name: studentName.trim(),
              email: studentEmail.trim() || null,
            })
            .select()
            .single();

          if (createError) throw createError;
          studentProfileId = newProfile.id;
        }

        const { error: insertError } = await supabase
          .from("community_members")
          .insert({
            community_id: params.id,
            member_type: "student_profile",
            user_id: null,
            student_profile_id: studentProfileId,
          });

        if (insertError) throw insertError;
      }

      setShowAddMemberModal(false);
      setUserEmail("");
      setStudentName("");
      setStudentEmail("");
      setError(null);
      setSuccess("Member added successfully");
      setTimeout(() => setSuccess(null), 3000);
      loadMembers();
    } catch (error: any) {
      console.error("Error adding member:", error);
      setError(`Failed to add member: ${error.message}`);
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    setError(null);
    setSuccess(null);
    
    if (!confirm("Are you sure you want to remove this member?")) return;

    try {
      const { error: deleteError } = await supabase
        .from("community_members")
        .delete()
        .eq("id", memberId);

      if (deleteError) throw deleteError;
      setSuccess("Member removed successfully");
      setTimeout(() => setSuccess(null), 3000);
      loadMembers();
    } catch (error: any) {
      console.error("Error removing member:", error);
      setError(`Failed to remove member: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <p>Loading community...</p>
        </div>
      </div>
    );
  }

  if (!community) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <p>Community not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-6xl mx-auto px-4">
        <Link href="/communities" className="text-blue-600 hover:underline mb-4 inline-block">
          ← Back to Communities
        </Link>

        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h1 className="text-3xl font-bold mb-2">{community.name}</h1>
          {community.description && (
            <p className="text-gray-600 mb-4">{community.description}</p>
          )}
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500">
              {members.length} member{members.length !== 1 ? "s" : ""}
            </span>
            <button
              onClick={() => setShowAddMemberModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
            >
              + Add Member
            </button>
          </div>
        </div>

        {/* Success/Error Messages */}
        {success && (
          <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-800">{success}</p>
          </div>
        )}
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b">
            <h2 className="text-xl font-semibold">Members</h2>
          </div>
          <div className="divide-y">
            {members.length === 0 ? (
              <div className="p-6 text-center text-gray-500">
                No members yet. Add your first member to get started.
              </div>
            ) : (
              members.map((member) => (
                <div key={member.id} className="p-6 flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {member.member_type === "user"
                        ? member.user?.email || `User (${member.user_id?.substring(0, 8)}...)` || "Unknown user"
                        : member.student_profile?.full_name ||
                          member.student_profile?.email ||
                          "Unknown student"}
                    </p>
                    <p className="text-sm text-gray-500">
                      {member.member_type === "user" ? "User" : "Student"} • {member.role}
                    </p>
                    {member.student_profile?.email && (
                      <p className="text-xs text-gray-400">{member.student_profile.email}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoveMember(member.id)}
                    className="text-red-600 hover:text-red-800 text-sm"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Add Member Modal */}
        {showAddMemberModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold mb-4">Add Member</h2>
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-800">{error}</p>
              </div>
            )}
            <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Member Type
                  </label>
                  <select
                    value={memberType}
                    onChange={(e) => setMemberType(e.target.value as "user" | "student_profile")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="user">Authenticated User</option>
                    <option value="student_profile">Student Profile</option>
                  </select>
                </div>

                {memberType === "user" ? (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      User Email *
                    </label>
                    <input
                      type="email"
                      value={userEmail}
                      onChange={(e) => setUserEmail(e.target.value)}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      placeholder="user@example.com"
                    />
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Student Name *
                      </label>
                      <input
                        type="text"
                        value={studentName}
                        onChange={(e) => setStudentName(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="John Doe"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Student Email (optional)
                      </label>
                      <input
                        type="email"
                        value={studentEmail}
                        onChange={(e) => setStudentEmail(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        placeholder="student@example.com"
                      />
                    </div>
                  </>
                )}

                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setShowAddMemberModal(false);
                      setUserEmail("");
                      setStudentName("");
                      setStudentEmail("");
                      setError(null);
                    }}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                    disabled={adding}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAddMember}
                    disabled={adding}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {adding ? "Adding..." : "Add"}
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

