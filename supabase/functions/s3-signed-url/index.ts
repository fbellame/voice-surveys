import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

// Helper function to calculate SHA256 hash
async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message)
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// Helper function to calculate HMAC-SHA256
async function hmacSha256(key: Uint8Array, message: string): Promise<Uint8Array> {
  const cryptoKey = await crypto.subtle.importKey(
    'raw', 
    key, 
    { name: 'HMAC', hash: 'SHA-256' }, 
    false, 
    ['sign']
  )
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, new TextEncoder().encode(message))
  return new Uint8Array(signature)
}

// Helper function to calculate AWS Signature Version 4
async function calculateSignature(
  secretAccessKey: string,
  dateString: string,
  region: string,
  service: string,
  stringToSign: string
): Promise<string> {
  const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${secretAccessKey}`), dateString)
  const kRegion = await hmacSha256(kDate, region)
  const kService = await hmacSha256(kRegion, service)
  const kSigning = await hmacSha256(kService, 'aws4_request')
  const signature = await hmacSha256(kSigning, stringToSign)
  
  return Array.from(signature).map(b => b.toString(16).padStart(2, '0')).join('')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { s3Url } = await req.json()
    
    console.log('Received S3 URL:', s3Url)
    
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
    const region = Deno.env.get('AWS_REGION') || "us-east-2"
    
    console.log('Parsed S3 details:', { bucket, key, region })
    
    // Get AWS credentials from environment
    const accessKeyId = Deno.env.get('AWS_ACCESS_KEY_ID')
    const secretAccessKey = Deno.env.get('AWS_SECRET_ACCESS_KEY')
    
    if (!accessKeyId || !secretAccessKey) {
      console.error('AWS credentials missing:', { accessKeyId: !!accessKeyId, secretAccessKey: !!secretAccessKey })
      return new Response(
        JSON.stringify({ error: "AWS credentials not configured" }),
        { 
          status: 500, 
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        }
      )
    }

    // Generate signed URL using AWS Signature Version 4
    const now = new Date()
    const dateString = now.toISOString().split('T')[0].replace(/-/g, '')
    const datetimeString = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
    
    const credential = `${accessKeyId}/${dateString}/${region}/s3/aws4_request`
    const signedHeaders = 'host'
    const expires = '3600' // 1 hour
    
    console.log('Signing details:', { dateString, datetimeString, credential })
    
    // Properly encode the key for URL path
    const encodedKey = key.split('/').map(part => encodeURIComponent(part)).join('/')
    
    // Create query string parameters in correct order (alphabetical)
    const queryParams = [
      `X-Amz-Algorithm=AWS4-HMAC-SHA256`,
      `X-Amz-Credential=${encodeURIComponent(credential)}`,
      `X-Amz-Date=${datetimeString}`,
      `X-Amz-Expires=${expires}`,
      `X-Amz-SignedHeaders=${signedHeaders}`
    ].join('&')
    
    // Create canonical request (must match exactly what will be signed)
    const canonicalHeaders = `host:${bucket}.s3.${region}.amazonaws.com\n`
    const canonicalRequest = `GET\n/${encodedKey}\n${queryParams}\n${canonicalHeaders}\n${signedHeaders}\nUNSIGNED-PAYLOAD`
    
    console.log('Canonical request:', canonicalRequest)
    
    // Create string to sign
    const stringToSign = `AWS4-HMAC-SHA256\n${datetimeString}\n${dateString}/${region}/s3/aws4_request\n${await sha256(canonicalRequest)}`
    
    console.log('String to sign:', stringToSign)
    
    // Calculate signature
    const signature = await calculateSignature(secretAccessKey, dateString, region, 's3', stringToSign)
    
    console.log('Generated signature:', signature)
    
    // Build final signed URL with query params in correct order
    const signedUrl = `https://${bucket}.s3.${region}.amazonaws.com/${encodedKey}?${queryParams}&X-Amz-Signature=${signature}`
    
    console.log('Final signed URL:', signedUrl)

    return new Response(
      JSON.stringify({ signedUrl }),
      { 
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  } catch (error) {
    console.error('Error generating signed URL:', error)
    return new Response(
      JSON.stringify({ error: "Failed to generate signed URL", details: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      }
    )
  }
})