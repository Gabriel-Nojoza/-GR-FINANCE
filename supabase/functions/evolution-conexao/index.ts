// @ts-nocheck -- Executado no Deno do Supabase.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });

  const authorization = request.headers.get("Authorization");
  const token = authorization?.replace(/^Bearer\s+/i, "");
  const authClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data: usuario } = await authClient.auth.getUser(token);
  if (!usuario.user) {
    return Response.json({ error: "Não autorizado" }, { status: 401, headers: cors });
  }

  const url = Deno.env.get("EVOLUTION_API_URL")?.replace(/\/$/, "");
  const apiKey = Deno.env.get("EVOLUTION_API_KEY");
  const instancia = Deno.env.get("EVOLUTION_INSTANCE") ?? "gr-finance";
  if (!url || !apiKey) {
    return Response.json({ error: "Evolution API não configurada" }, { status: 500, headers: cors });
  }

  const headers = { apikey: apiKey, "Content-Type": "application/json" };
  const estadoResposta = await fetch(
    `${url}/instance/connectionState/${encodeURIComponent(instancia)}`,
    { headers },
  );
  const estadoJson = await estadoResposta.json().catch(() => ({}));
  const estado = estadoJson.instance?.state ?? estadoJson.state ?? "close";

  if (estado === "open") {
    return Response.json({ estado, instancia, conectado: true }, { headers: cors });
  }

  const qrResposta = await fetch(
    `${url}/instance/connect/${encodeURIComponent(instancia)}`,
    { headers },
  );
  const qrJson = await qrResposta.json().catch(() => ({}));
  return Response.json(
    {
      estado,
      instancia,
      conectado: false,
      qrcode: qrJson.base64 ?? qrJson.qrcode?.base64 ?? null,
      pairingCode: qrJson.pairingCode ?? qrJson.code ?? null,
    },
    { status: qrResposta.ok ? 200 : qrResposta.status, headers: cors },
  );
});

