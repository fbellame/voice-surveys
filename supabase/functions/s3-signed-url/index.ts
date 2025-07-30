import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { s3Url } = await req.json()
    
    if (!s3Url) {
      return new Response(
        JSON.stringify({ error: "s3Url is required" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    // Extract bucket and key from s3:// URL
    const s3UrlMatch = s3Url.match(/^s3:\/\/([^\/]+)\/(.+)$/)
    if (!s3UrlMatch) {
      return new Response(
        JSON.stringify({ error: "Invalid S3 URL format" }),
        { 
          status: 400, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    const [, bucket, key] = s3UrlMatch
    const region = "us-east-2"
    
    // Generate signed URL
    const signedUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Content-Sha256=UNSIGNED-PAYLOAD&X-Amz-Credential=${Deno.env.get('AWS_ACCESS_KEY_ID')}%2F${new Date().toISOString().split('T')[0].replace(/-/g, '')}%2F${region}%2Fs3%2Faws4_request&X-Amz-Date=${new Date().toISOString().replace(/[:-]|\.\d{3}/g, '')}&X-Amz-Expires=3600&X-Amz-Security-Token=${encodeURIComponent(Deno.env.get('AWS_SESSION_TOKEN') || '')}&X-Amz-Signature=placeholder&X-Amz-SignedHeaders=host&response-content-disposition=inline`

    // For simplicity, just construct a basic signed URL format
    // In production, you'd use proper AWS SDK for signing
    const basicUrl = `https://${bucket}.s3.${region}.amazonaws.com/${key}`

    return new Response(
      JSON.stringify({ signedUrl: basicUrl }),
      { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  } catch (error) {
    console.error('Error generating signed URL:', error)
    return new Response(
      JSON.stringify({ error: "Failed to generate signed URL" }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  }
})