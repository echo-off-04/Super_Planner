import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface RemotePrestation {
  external_id: string;
  title: string;
  start_time: string;
  end_time: string;
  location?: string;
  notes?: string;
  activity_type?: string;
}

async function fetchRemotePrestations(
  _since: string | null
): Promise<RemotePrestation[]> {
  const apiKey = Deno.env.get("BOKU_KUMASALA_API_KEY");
  const apiUrl = Deno.env.get("BOKU_KUMASALA_API_URL");
  if (!apiKey || !apiUrl) return [];

  const url = new URL("/v1/prestations", apiUrl);
  if (_since) url.searchParams.set("since", _since);

  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    throw new Error(`Boku API error ${res.status}`);
  }
  const data = (await res.json()) as { prestations?: RemotePrestation[] };
  return data.prestations ?? [];
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as { since?: string };
    const since = body.since ?? null;

    const remote = await fetchRemotePrestations(since);

    let imported = 0;
    let skipped = 0;

    for (const p of remote) {
      const { data: existing } = await supabase
        .from("activities")
        .select("id")
        .eq("user_id", user.id)
        .eq("source", "boku_kumasala")
        .eq("external_id", p.external_id)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      const { error: insertError } = await supabase.from("activities").insert({
        user_id: user.id,
        title: p.title,
        activity_type: p.activity_type ?? "prestation",
        start_time: p.start_time,
        end_time: p.end_time,
        location: p.location ?? "",
        notes: p.notes ?? "",
        source: "boku_kumasala",
        external_id: p.external_id,
      });

      if (!insertError) imported++;
    }

    return new Response(
      JSON.stringify({ imported, skipped, total: remote.length }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
