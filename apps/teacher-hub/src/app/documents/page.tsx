"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";

interface Document {
  id: string;
  title: string;
  pages: number;
  created_at: string;
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from("documents")
        .select("id, title, pages, created_at")
        .order("created_at", { ascending: false });

      if (error) throw error;

      setDocuments(data || []);
    } catch (error) {
      console.error("Error loading documents:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <p>Loading documents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold">My Documents</h1>
          <Link
            href="/upload"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            Upload New PDF
          </Link>
        </div>

        {documents.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 text-center">
            <p className="text-gray-600 mb-4">No documents yet.</p>
            <Link
              href="/upload"
              className="text-blue-600 hover:underline"
            >
              Upload a PDF to get started
            </Link>
          </div>
        ) : (
          <div className="grid gap-4">
            {documents.map((document) => (
              <div
                key={document.id}
                className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition"
              >
                <Link href={`/documents/${document.id}`}>
                  <h2 className="text-xl font-semibold mb-2">{document.title}</h2>
                  <p className="text-sm text-gray-600 mb-2">
                    Pages: {document.pages}
                  </p>
                  <p className="text-xs text-gray-500">
                    Created: {new Date(document.created_at).toLocaleDateString()}
                  </p>
                </Link>
                <div className="mt-4">
                  <Link
                    href={`/documents/${document.id}`}
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    View Document
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

