import { createClient } from "https://esm.sh";
// Import DOMParser for Deno to handle serverside HTML parsing
import { DOMParser } from "https://deno.land";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const url = new URL(req.url);
    
    // Trigger the scraper via a POST request or a scheduled cron job
    if (req.method === "POST") {
      const body = await req.json();
      const ticker = body.ticker?.toUpperCase();

      if (!ticker) {
        return new Response(JSON.stringify({ error: "Ticker parameter is required" }), { status: 400 });
      }

      // 1. Fetch the raw HTML content from the ticker site
      // (Note: Adjust target URL path structure based on their exact ticker routing, e.g., /stock/AAPL)
      const targetUrl = `https://tickergate.com{ticker}`;
      const response = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch webpage data: ${response.statusText}`);
      }

      const html = await response.text();

      // 2. Parse the HTML tree using Deno DOM
      const document = new DOMParser().parseFromString(html, "text/html");
      if (!document) {
        throw new Error("Failed to parse HTML document structure");
      }

      // 3. Extract text elements using standard CSS selectors
      // Replace '.stock-price-class' and '.pe-ratio-class' with the website's exact element classes
      const rawPrice = document.querySelector(".stock-price-class")?.textContent?.trim() || "0";
      const rawPE = document.querySelector(".pe-ratio-class")?.textContent?.trim() || "N/A";
      const rawMarketCap = document.querySelector(".market-cap-class")?.textContent?.trim() || "N/A";

      const cleanedPrice = parseFloat(rawPrice.replace(/[^0-9.]/g, "")) || 0;

      // 4. Structure data for your flexible JSONB columns
      const scrapedRecord = {
        ticker: ticker,
        price: cleanedPrice,
        metrics: {
          scraped_pe_ratio: rawPE,
          scraped_market_cap: rawMarketCap,
          source_url: targetUrl
        }
      };

      // 5. Save the records straight to your stock_data table
      const { data, error } = await supabaseClient
        .from("stock_data")
        .insert([scrapedRecord])
        .select();

      if (error) throw error;

      return new Response(JSON.stringify({ success: true, message: `Scraped and saved ${ticker}`, data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 201,
      });
    }

    return new Response(JSON.stringify({ error: "Method not allowed" }), { headers: corsHeaders, status: 405 });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
