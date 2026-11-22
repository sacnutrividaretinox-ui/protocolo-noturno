"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { disciplineScore, streakFrom } from "@/lib/score";

type Mission = { id: string; title: string; difficulty: number };
type Msg = { role: "user" | "assistant"; content: string };
type Checkin = { day: string; score: number };
type Log = { mission_id: string; day: string; done: boolean };
type Aba = "visao" | "missoes" | "diario" | "mentor";

const dia = (offset = 0) => new Date(Date.now() + offset * 864e5).toLocaleDateString("sv-SE");
const hoje = () => dia(0);
const NIVEIS = [["firme", "Mentor firme"], ["duro", "Duro"], ["implacavel", "Implacável"]];
const ICONES: Record<Aba, string> = {
  visao: "M3 11l9-8 9 8v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z",
  missoes: "M20 6L9 17l-5-5",
  diario: "M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z",
  mentor: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
};
const NOMES: Record<Aba, string> = { visao: "Visão geral", missoes: "Missões", diario: "Diário", mentor: "Mentor" };

function Gauge({ valor }: { valor: number }) {
  return (
    <svg viewBox="0 0 220 130" aria-hidden="true">
      <defs>
        <linearGradient id="g" x1="0" x2="1"><stop offset="0" stopColor="#3d8bff" /><stop offset="1" stopColor="#35d0e8" /></linearGradient>
      </defs>
      <path d="M20 118 A90 90 0 0 1 200 118" fill="none" stroke="#14264a" strokeWidth="14" strokeLinecap="round" />
      <path d="M20 118 A90 90 0 0 1 200 118" fill="none" stroke="url(#g)" strokeWidth="14" strokeLinecap="round" pathLength={100} strokeDasharray={`${valor} 100`} />
    </svg>
  );
}

function Evolucao({ pontos }: { pontos: Checkin[] }) {
  if (pontos.length < 2) return <p className="muted">Salve pelo menos dois check-ins para ver a evolução.</p>;
  const W = 600, H = 180, pad = 8;
  const xy = pontos.map((p, i) => [pad + (i / (pontos.length - 1)) * (W - pad * 2), H - pad - (p.score / 100) * (H - pad * 2)]);
  const linha = xy.map((p) => p.join(",")).join(" ");
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Evolução do score">
      <polygon points={`${pad},${H} ${linha} ${W - pad},${H}`} fill="rgba(61,139,255,.15)" />
      <polyline points={linha} fill="none" stroke="#3d8bff" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      {xy.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill="#35d0e8" />)}
    </svg>
  );
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState("");
  const [aviso, setAviso] = useState("");
  const [aba, setAba] = useState<Aba>("visao");

  const [missions, setMissions] = useState<Mission[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
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
      supabase.from("mission_logs").select("mission_id,day,done").gte("day", dia(-13)),
      supabase.from("checkins").select("day,score").order("day", { ascending: false }).limit(30),
      supabase.from("messages").select("role,content").order("created_at", { ascending: false }).limit(20),
    ]);
    setMissions(m.data ?? []);
    setLogs(l.data ?? []);
    setCheckins(c.data ?? []);
    setMsgs(((h.data ?? []) as Msg[]).reverse());
  }, []);

  useEffect(() => { if (session) carregar(); }, [session, carregar]);

  const done = useMemo(
    () => Object.fromEntries(logs.filter((l) => l.day === hoje()).map((l) => [l.mission_id, l.done])) as Record<string, boolean>,
    [logs]
  );

  async function entrar(e: React.FormEvent) {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: window.location.origin } });
    setAviso(error ? "Não foi possível enviar o link: " + error.message : "Link enviado. Abra seu e-mail neste aparelho.");
  }

  async function alternar(m: Mission) {
    const novo = !done[m.id];
    setLogs((prev) => [...prev.filter((l) => !(l.mission_id === m.id && l.day === hoje())), { mission_id: m.id, day: hoje(), done: novo }]);
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

  const diasCheckin = checkins.map((c) => c.day);
  const scoreSalvo = checkins.find((c) => c.day === hoje())?.score;
  const streakAnterior = streakFrom(diasCheckin.filter((d) => d !== hoje()), dia(-1));
  const scoreHoje = disciplineScore(missions.map((m) => ({ done: !!done[m.id], difficulty: m.difficulty })), streakAnterior + 1);
  const score = scoreSalvo ?? scoreHoje;
  const streak = streakFrom(diasCheckin, scoreSalvo !== undefined ? hoje() : dia(-1));
  const concluidas = missions.filter((m) => done[m.id]).length;
  const ultimos7 = checkins.slice(0, 7);
  const media7 = ultimos7.length ? Math.round(ultimos7.reduce((s, c) => s + c.score, 0) / ultimos7.length) : 0;
  const status = score < 40 ? "Em formação" : score < 70 ? "Firme" : "Forte";
  const ultimoMentor = [...msgs].reverse().find((m) => m.role === "assistant");

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

  if (!ready) return null;

  if (!session)
    return (
      <main className="login">
        <h1>Protocolo Noturno</h1>
        <p className="muted" style={{ marginBottom: 28 }}>Você não nasce disciplinado. Você treina até virar. Um mentor de IA cobra sua rotina todos os dias, com a firmeza que você escolher.</p>
        <form onSubmit={entrar} className="row">
          <input type="email" required placeholder="seu@email.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-label="E-mail" />
          <button type="submit">Receber link de acesso</button>
        </form>
        {aviso && <p className="muted" style={{ marginTop: 12 }}>{aviso}</p>}
      </main>
    );

  return (
    <div className="shell">
      <nav className="side" aria-label="Principal">
        <div className="brand">Protocolo Noturno</div>
        {(Object.keys(NOMES) as Aba[]).map((k) => (
          <button key={k} className={"nav" + (aba === k ? " on" : "")} onClick={() => setAba(k)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d={ICONES[k]} /></svg>{NOMES[k]}
          </button>
        ))}
        <button className="ghost sair" onClick={() => supabase.auth.signOut()}>Sair</button>
      </nav>

      <main className="main">
        {aba === "visao" && (
          <>
            <div className="grid2">
              <div className="card hero">
                <svg viewBox="0 0 100 100" aria-hidden="true">
                  <defs><radialGradient id="lua" cx=".35" cy=".35"><stop offset="0" stopColor="#bfe0ff" /><stop offset="1" stopColor="#2f74e6" /></radialGradient></defs>
                  <circle cx="50" cy="50" r="34" fill="url(#lua)" />
                  <circle cx="64" cy="42" r="30" fill="#0b1c3a" />
                </svg>
                <h1>Sentinela</h1>
                <p className="muted">Sua camada de disciplina diária</p>
              </div>
              <div className="card gauge">
                <h3>Prontidão de hoje</h3>
                <Gauge valor={score} />
                <div className="num">{score}<small>/100</small></div>
                <div className="tag">{status}</div>
              </div>
            </div>

            <div className="grid4">
              <div className="card stat"><h3>Sequência</h3><div className="n">{streak}</div><div className="s">dias seguidos</div></div>
              <div className="card stat"><h3>Missões hoje</h3><div className="n">{concluidas}/{missions.length}</div><div className="s">concluídas</div></div>
              <div className="card stat"><h3>Média 7 dias</h3><div className="n">{media7}</div><div className="s">score médio</div></div>
              <div className="card stat"><h3>Check-ins</h3><div className="n">{checkins.length}</div><div className="s">registrados</div></div>
            </div>

            <div className="grid2b">
              <div className="card">
                <h3>Missões: cumprimento em 14 dias</h3>
                {missions.length === 0 && <p className="muted">Crie missões na aba Missões.</p>}
                {missions.slice(0, 6).map((m) => {
                  const pct = Math.round((logs.filter((l) => l.mission_id === m.id && l.done).length / 14) * 100);
                  return (
                    <div className="bar" key={m.id}>
                      <div className="top"><span>{m.title}</span><span>{pct}%</span></div>
                      <div className="trilho"><div className="fill" style={{ width: pct + "%" }} /></div>
                    </div>
                  );
                })}
              </div>
              <div className="card">
                <h3>Evolução do score</h3>
                <Evolucao pontos={[...checkins].reverse()} />
              </div>
            </div>

            <div className="card">
              <h3>Atividade recente</h3>
              <div className="ativ">
                {checkins.slice(0, 3).map((c) => (
                  <div key={c.day}>Check-in salvo, score {c.score}<small>{c.day.split("-").reverse().slice(0, 2).join("/")}</small></div>
                ))}
                {ultimoMentor && <div>Mentor: {ultimoMentor.content.slice(0, 70)}…<small>última resposta</small></div>}
                {checkins.length === 0 && !ultimoMentor && <p className="muted">Nada por aqui ainda.</p>}
              </div>
            </div>
          </>
        )}

        {aba === "missoes" && (
          <div className="card">
            <h3>Missões de hoje</h3>
            {missions.length === 0 && <p className="muted">Nenhuma missão ainda. Adicione a primeira abaixo.</p>}
            {missions.map((m) => (
              <label key={m.id} className={"mission" + (done[m.id] ? " done" : "")}>
                <input type="checkbox" checked={!!done[m.id]} onChange={() => alternar(m)} />
                <span>{m.title}</span>
                <span className="muted" style={{ marginLeft: "auto" }}>dificuldade {m.difficulty}</span>
              </label>
            ))}
            <form onSubmit={adicionar} className="row" style={{ marginTop: 16 }}>
              <input placeholder="Ex.: Treinar 40 minutos" value={novaMissao} onChange={(e) => setNovaMissao(e.target.value)} aria-label="Nova missão" />
              <select value={dificuldade} onChange={(e) => setDificuldade(+e.target.value)} aria-label="Dificuldade">
                <option value={1}>Leve</option><option value={2}>Média</option><option value={3}>Difícil</option>
              </select>
              <button type="submit">Adicionar</button>
            </form>
          </div>
        )}

        {aba === "diario" && (
          <div className="card">
            <h3>Fechar o dia</h3>
            <p className="muted" style={{ marginBottom: 14 }}>Score de hoje: <b style={{ color: "#fff" }}>{score}</b>. Até 80 pontos pelas missões (peso por dificuldade) e até 20 pela sequência de dias.</p>
            <textarea placeholder="O que você fez, o que falhou, o que aprendeu?" value={diario} onChange={(e) => setDiario(e.target.value)} aria-label="Diário" />
            <button style={{ marginTop: 12 }} onClick={fecharDia}>{scoreSalvo !== undefined ? "Atualizar check-in" : "Salvar check-in"}</button>
          </div>
        )}

        {aba === "mentor" && (
          <div className="card">
            <h3>Mentor Sentinela</h3>
            <div className="row" style={{ marginBottom: 14 }}>
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
          </div>
        )}
      </main>
    </div>
  );
}
