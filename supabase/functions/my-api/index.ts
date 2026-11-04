import { createClient } from "https://esm.sh";

// 1. Define CORS headers to allow cross-origin requests from frontend apps
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  // 2. Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // 3. Initialize the Supabase Client using internal Edge Function system variables
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const url = new URL(req.url);
    const method = req.method;

  // Replace the GET block inside your index.ts with this ticker-aware query framework:
if (method === "GET") {
  const tickerParam = url.searchParams.get("ticker");

  let query = supabaseClient
    .from("stock_data")
    .select("*")
    .order("recorded_at", { ascending: false }); // Show newest entries first

  if (tickerParam) {
    query = query.eq("ticker", tickerParam.toUpperCase());
  }

  const { data, error } = await query;
  if (error) throw error;

  return new Response(JSON.stringify({ success: true, data }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
}

// Replace the POST block inside your index.ts to write straight to stock_data:
if (method === "POST") {
  const body = await req.json();

  const { data, error } = await supabaseClient
    .from("stock_data")
    .insert([body])
    .select();

  if (error) throw error;

  return new Response(JSON.stringify({ success: true, data }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 201,
  });
}

    // 6. Catch-all for unsupported methods
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 405,
    });

  } catch (error) {
    // 7. Global error catching framework
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
