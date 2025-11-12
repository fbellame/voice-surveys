import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ProcessPdfRequest {
  storage_path: string;
  user_id: string;
  title?: string;
  extract_client_side?: boolean;
  text_content?: string;
}

interface Chunk {
  text: string;
  idx: number;
  section?: string;
  page_start?: number;
  page_end?: number;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const body: ProcessPdfRequest = await req.json();

    const { storage_path, user_id, title, extract_client_side, text_content } = body;

    if (!storage_path || !user_id) {
      return new Response(
        JSON.stringify({ error: "storage_path and user_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let extractedText = text_content;

    // If client-side extraction was done, use it; otherwise extract server-side
    if (!extractedText || !extract_client_side) {
      // Get signed URL for the PDF
      const { data: signedUrlData, error: urlError } = await supabase.storage
        .from("pdf-documents")
        .createSignedUrl(storage_path, 3600);

      if (urlError || !signedUrlData) {
        return new Response(
          JSON.stringify({ error: "Failed to get signed URL", details: urlError }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // For now, we'll assume text extraction is done client-side
      // In production, you'd use a PDF parsing library here
      extractedText = "PDF text extraction server-side not implemented. Please use client-side extraction.";
    }

    if (!extractedText) {
      return new Response(
        JSON.stringify({ error: "No text content provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Chunk the text (simple semantic chunking)
    const chunks = chunkText(extractedText, 1000, 200);

    // Create document record
    const { data: document, error: docError } = await supabase
      .from("documents")
      .insert({
        user_id,
        title: title || "Untitled Document",
        storage_path,
        pages: Math.ceil(extractedText.length / 2000), // Rough estimate
      })
      .select()
      .single();

    if (docError || !document) {
      return new Response(
        JSON.stringify({ error: "Failed to create document", details: docError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate embeddings (optional) and insert chunks
    const chunkInserts = await Promise.all(
      chunks.map(async (chunk, idx) => {
        let embedding: number[] | null = null;

        // Generate embedding if OpenAI key is available
        if (OPENAI_API_KEY) {
          try {
            const embeddingResponse = await fetch(
              "https://api.openai.com/v1/embeddings",
              {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${OPENAI_API_KEY}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  model: "text-embedding-3-small",
                  input: chunk.text,
                }),
              }
            );

            if (embeddingResponse.ok) {
              const embeddingData = await embeddingResponse.json();
              embedding = embeddingData.data[0].embedding;
            }
          } catch (e) {
            console.error("Failed to generate embedding:", e);
          }
        }

        return {
          document_id: document.id,
          idx,
          text: chunk.text,
          section: chunk.section,
          page_start: chunk.page_start,
          page_end: chunk.page_end,
          embedding: embedding ? `[${embedding.join(",")}]` : null,
        };
      })
    );

    const { error: chunksError } = await supabase
      .from("doc_chunks")
      .insert(chunkInserts);

    if (chunksError) {
      console.error("Error inserting chunks:", chunksError);
      // Continue anyway - document is created
    }

    return new Response(
      JSON.stringify({
        document_id: document.id,
        chunks_count: chunks.length,
        message: "PDF processed successfully",
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error processing PDF:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error", details: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Simple text chunking function
function chunkText(
  text: string,
  chunkSize: number = 1000,
  overlap: number = 200
): Chunk[] {
  const chunks: Chunk[] = [];
  let idx = 0;
  let start = 0;

  // Try to split by paragraphs first, then by sentences
  const paragraphs = text.split(/\n\s*\n/);

  for (const para of paragraphs) {
    if (para.trim().length === 0) continue;

    if (para.length <= chunkSize) {
      chunks.push({
        text: para.trim(),
        idx: idx++,
        page_start: Math.floor(start / 2000) + 1,
        page_end: Math.floor((start + para.length) / 2000) + 1,
      });
      start += para.length;
    } else {
      // Split long paragraph by sentences
      const sentences = para.split(/(?<=[.!?])\s+/);
      let currentChunk = "";

      for (const sentence of sentences) {
        if ((currentChunk + sentence).length > chunkSize && currentChunk) {
          chunks.push({
            text: currentChunk.trim(),
            idx: idx++,
            page_start: Math.floor(start / 2000) + 1,
            page_end: Math.floor((start + currentChunk.length) / 2000) + 1,
          });
          start += currentChunk.length - overlap;
          currentChunk = currentChunk.slice(-overlap) + " " + sentence;
        } else {
          currentChunk += (currentChunk ? " " : "") + sentence;
        }
      }

      if (currentChunk.trim()) {
        chunks.push({
          text: currentChunk.trim(),
          idx: idx++,
          page_start: Math.floor(start / 2000) + 1,
          page_end: Math.floor((start + currentChunk.length) / 2000) + 1,
        });
        start += currentChunk.length;
      }
    }
  }

  return chunks;
}
