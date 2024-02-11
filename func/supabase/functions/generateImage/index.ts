// Generate an image for a word which doesn't have a good match

import OpenAI from 'https://deno.land/x/openai@v4.24.0/mod.ts'

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

export const imageGenPrompt = `Create a simplified image that is an icon representing "XXXX".
Use only primary colors on a white background. The design is 
minimalist with no additional detail. Do not use any character or typography on the image.
This image should resemble the stylistic approach of icons utilized in an 
AAC (Augmentative and Alternative Communication) application.`

export const imageGenModel = "dall-e-2";

Deno.serve(async (req) => {
  // Search query is passed in request payload
  const { word } = await req.json()
  console.log("Generate Images Call: " + word)

  // Handle CORS if call is from Browser
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try{
    // Init Supabase client with the Auth context of the logged in user
    const authHeader = req.headers.get('Authorization')!
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Now we can get the session or user object
    const {data: { user, error }, } = await supabaseClient.auth.getUser()
    if (error) throw error

    var grantedAccess = false
    if (user['user_metadata'] != null && user['user_metadata']['can_access'] != null) {
      grantedAccess = user['user_metadata']['can_access']
    }

    // Gate only users with learningo emails or explicit access
    if (!(user['email'].endsWith("@learningo.org") || grantedAccess)) {
      return new Response(JSON.stringify({ error: "Not allowed" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    // OpenAI recommends replacing newlines with spaces for best results
    const input = word.replace(/\n/g, ' ')
    const prompt = imageGenPrompt.replace("XXXX", input)

    const apiKey = Deno.env.get('OPENAI_API_KEY')
    const openai = new OpenAI({
      apiKey: apiKey,
    })

    // Generate embedding for the query itself
    var imgResponse = await openai.images.generate({
      model: imageGenModel,
      prompt: prompt,
      n: 1,
      size: "512x512",
      response_format: "b64_json"
    })

    if (imgResponse.data && imgResponse.data.length > 0) {
        const responseData = imgResponse.data[0]['b64_json']

        return new Response(JSON.stringify(responseData), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200
        })
    } else {
      return new Response('ERROR: No image returned', { status: 404, headers: corsHeaders })
    }
  } catch (error) {
    console.log("ERR: " + error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
