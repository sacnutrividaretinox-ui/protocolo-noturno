import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@supabase/supabase-js";
import { buildSystemPrompt, looksDistressed, Intensity } from "@/lib/mentor";

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return Response.json({ error: "Não autorizado." }, { status: 401 });

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: auth } = await sb.auth.getUser(token);
  if (!auth.user) return Response.json({ error: "Sessão inválida." }, { status: 401 });

  const { message, intensity, goal } = (await req.json()) as { message: string; intensity: Intensity; goal?: string };
  if (!message?.trim()) return Response.json({ error: "Mensagem vazia." }, { status: 400 });

  const since = new Date(Date.now() - 14 * 864e5).toLocaleDateString("sv-SE");
  const [{ data: checkins }, { data: logs }, { data: past }] = await Promise.all([
    sb.from("checkins").select("day,score,journal").gte("day", since).order("day"),
    sb.from("mission_logs").select("day,done,missions(title)").gte("day", since).order("day"),
    sb.from("messages").select("role,content").order("created_at", { ascending: false }).limit(10),
  ]);

  const context =
    [
      ...(checkins ?? []).map((c) => `${c.day}: score ${c.score}. Diário: ${c.journal ?? "-"}`),
      ...((logs as any[]) ?? []).map((l) => `${l.day}: ${l.missions?.title} -> ${l.done ? "feita" : "falhou"}`),
    ].join("\n") || "Sem histórico ainda.";

  const distressed = looksDistressed(message);
  const history = (past ?? []).reverse().filter((m, i, a) => i > 0 || m.role === "user") as { role: "user" | "assistant"; content: string }[];

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const res = await client.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5-5",
    max_tokens: 500,
    system: buildSystemPrompt(intensity ?? "firme", goal ?? null, context, distressed),
    messages: [...history, { role: "user", content: message }],
  });
  const reply = res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();

  await sb.from("messages").insert([
    { role: "user", content: message },
    { role: "assistant", content: reply },
  ]);
  return Response.json({ reply });
}
