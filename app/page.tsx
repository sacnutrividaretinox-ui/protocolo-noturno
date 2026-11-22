"use client";
import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { disciplineScore, streakFrom } from "@/lib/score";

type Mission = { id: string; title: string; difficulty: number };
type Msg = { role: "user" | "assistant"; content: string };
type Checkin = { day: string; score: number };

const hoje = () => new Date().toLocaleDateString("sv-SE");
const NIVEIS = [["firme", "Mentor firme"], ["duro", "Duro"], ["implacavel", "Implacável"]];

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [aviso, setAviso] = useState("");

  const [missions, setMissions] = useState<Mission[]>([]);
  const [done, setDone] = useState<Record<string, boolean>>({});
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [novaMissao, setNovaMissao] = useState("");
  const [dificuldade, setDificuldade] = useState(2);
  const [diario, setDiario] = useState("");
  const [objetivo, setObjetivo] = useState("");
  const [intensidade, setIntensidade] = useState("firme");
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    setObjetivo(localStorage.getItem("objetivo") ?? "");
    setIntensidade(localStorage.getItem("intensidade") ?? "firme");
    return () => sub.subscription.unsubscribe();
  }, []);

  const carregar = useCallback(async () => {
    const [m, l, c, h] = await Promise.all([
      supabase.from("missions").select("id,title,difficulty").eq("active", true).order("created_at"),
      supabase.from("mission_logs").select("mission_id,done").eq("day", hoje()),
      supabase.from("checkins").select("day,score").order("day", { ascending: false }).limit(30),
      supabase.from("messages").select("role,content").order("created_at", { ascending: false }).limit(20),
    ]);
    setMissions(m.data ?? []);
    setDone(Object.fromEntries((l.data ?? []).map((x) => [x.mission_id, x.done])));
    setCheckins(c.data ?? []);
    setMsgs(((h.data ?? []) as Msg[]).reverse());
  }, []);

  useEffect(() => { if (session) carregar(); }, [session, carregar]);

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    setAviso(error ? "Não foi possível enviar o link: " + error.message : "Link enviado. Abra seu e-mail neste aparelho.");
  }

  async function alternar(m: Mission) {
    const novo = !done[m.id];
    setDone({ ...done, [m.id]: novo });
    await supabase.from("mission_logs").upsert(
      { user_id: session!.user.id, mission_id: m.id, day: hoje(), done: novo },
      { onConflict: "mission_id,day" }
    );
  }

  async function adicionar(e: React.FormEvent) {
    e.preventDefault();
    if (!novaMissao.trim()) return;
    await supabase.from("missions").insert({ title: novaMissao.trim(), difficulty: dificuldade });
    setNovaMissao("");
    carregar();
  }

  const streakAnterior = streakFrom(checkins.map((c) => c.day).filter((d) => d !== hoje()), new Date(Date.now() - 864e5).toLocaleDateString("sv-SE"));
  const scoreHoje = disciplineScore(missions.map((m) => ({ done: !!done[m.id], difficulty: m.difficulty })), streakAnterior + 1);
  const scoreSalvo = checkins.find((c) => c.day === hoje())?.score;

  async function fecharDia() {
    await supabase.from("checkins").upsert(
      { user_id: session!.user.id, day: hoje(), score: scoreHoje, journal: diario },
      { onConflict: "user_id,day" }
    );
    setDiario("");
    carregar();
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (!texto.trim() || enviando) return;
    const msg = texto.trim();
    setTexto(""); setEnviando(true);
    setMsgs((x) => [...x, { role: "user", content: msg }]);
    try {
      const r = await fetch("/api/mentor", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session!.access_token}` },
        body: JSON.stringify({ message: msg, intensity: intensidade, goal: objetivo }),
      });
      const j = await r.json();
      setMsgs((x) => [...x, { role: "assistant", content: j.reply ?? j.error ?? "Falha ao falar com o mentor." }]);
    } finally { setEnviando(false); }
  }

  if (!ready) return <main />;

  if (!session)
    return (
      <main>
        <h1>Protocolo Noturno</h1>
        <p style={{ marginTop: 16 }}>Você não nasce disciplinado. Você treina até virar. Um mentor de IA cobra sua rotina todos os dias, com a firmeza que você escolher.</p>
        <form onSubmit={entrar} style={{ marginTop: 28 }} className="row">
          <input type="email" required placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="E-mail" />
          <button type="submit">Receber link de acesso</button>
        </form>
        {aviso && <p className="muted" style={{ marginTop: 12 }}>{aviso}</p>}
      </main>
    );

  return (
    <main>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h1 style={{ fontSize: "1.8rem" }}>Protocolo Noturno</h1>
        <button className="ghost" onClick={() => supabase.auth.signOut()}>Sair</button>
      </div>

      <section>
        <h2>Missões de hoje</h2>
        {missions.length === 0 && <p className="muted">Nenhuma missão ainda. Adicione a primeira abaixo.</p>}
        {missions.map((m) => (
          <label key={m.id} className={"mission" + (done[m.id] ? " done" : "")}>
            <input type="checkbox" checked={!!done[m.id]} onChange={() => alternar(m)} />
            <span>{m.title}</span>
            <span className="muted" style={{ marginLeft: "auto" }}>dificuldade {m.difficulty}</span>
          </label>
        ))}
        <form onSubmit={adicionar} className="row" style={{ marginTop: 14 }}>
          <input placeholder="Ex.: Treinar 40 minutos" value={novaMissao} onChange={(e) => setNovaMissao(e.target.value)} aria-label="Nova missão" />
          <select value={dificuldade} onChange={(e) => setDificuldade(+e.target.value)} aria-label="Dificuldade">
            <option value={1}>Leve</option><option value={2}>Média</option><option value={3}>Difícil</option>
          </select>
          <button type="submit">Adicionar missão</button>
        </form>
      </section>

      <section>
        <h2>Fechar o dia</h2>
        <div className="row" style={{ alignItems: "baseline", gap: 16, marginBottom: 12 }}>
          <div className="score">{scoreSalvo ?? scoreHoje}</div>
          <p className="muted">Score de disciplina. Até 80 pontos pelas missões (peso por dificuldade) e até 20 pela sequência de dias.</p>
        </div>
        <textarea placeholder="O que você fez, o que falhou, o que aprendeu?" value={diario} onChange={(e) => setDiario(e.target.value)} aria-label="Diário" />
        <button style={{ marginTop: 10 }} onClick={fecharDia}>{scoreSalvo !== undefined ? "Atualizar check-in" : "Salvar check-in"}</button>
      </section>

      <section>
        <h2>Mentor</h2>
        <div className="row" style={{ marginBottom: 12 }}>
          <input placeholder="Seu objetivo (ex.: acordar às 5h e treinar)" value={objetivo} aria-label="Objetivo"
            onChange={(e) => { setObjetivo(e.target.value); localStorage.setItem("objetivo", e.target.value); }} />
          <select value={intensidade} aria-label="Intensidade"
            onChange={(e) => { setIntensidade(e.target.value); localStorage.setItem("intensidade", e.target.value); }}>
            {NIVEIS.map(([v, n]) => <option key={v} value={v}>{n}</option>)}
          </select>
        </div>
        <div className="chat">
          {msgs.length === 0 && <p className="muted">Conte ao mentor como foi seu dia ou o que está te travando.</p>}
          {msgs.map((m, i) => <div key={i} className={"msg " + m.role}>{m.content}</div>)}
        </div>
        <form onSubmit={enviar} className="row">
          <input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Fale com o mentor" aria-label="Mensagem" />
          <button type="submit" disabled={enviando}>{enviando ? "Aguarde" : "Enviar"}</button>
        </form>
      </section>
    </main>
  );
}
