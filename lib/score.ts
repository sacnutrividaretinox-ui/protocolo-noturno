// Score de disciplina (0-100), transparente:
//  - até 80 pontos: missões cumpridas, ponderadas pela dificuldade (1 a 3)
//  - até 20 pontos: consistência (1 ponto de bônus ≈ 0,35 dia de sequência, máx. 7 dias)
export type LogItem = { done: boolean; difficulty: number };

export function disciplineScore(items: LogItem[], streak: number) {
  const total = items.reduce((s, i) => s + i.difficulty, 0);
  const done = items.reduce((s, i) => s + (i.done ? i.difficulty : 0), 0);
  const base = total ? Math.round((done / total) * 80) : 0;
  const bonus = Math.round((Math.min(streak, 7) / 7) * 20);
  return Math.min(100, base + bonus);
}

// days: datas (YYYY-MM-DD) com check-in. Conta dias seguidos até hoje.
export function streakFrom(days: string[], today: string) {
  const set = new Set(days);
  let n = 0;
  const d = new Date(today + "T12:00:00");
  while (set.has(d.toLocaleDateString("sv-SE"))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}
