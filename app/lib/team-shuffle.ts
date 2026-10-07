/**
 * 정렬 순서 i 의 시드(1~3). 등수 번호가 아니라 "정렬 순서"로 3등분한다.
 * 등수는 동점이면 건너뛰므로(1,1,1,4,4,4,7…) 번호로 자르면 시드별 인원이 틀어진다.
 * (24명 → 8/8/8, 21명 → 7/7/7, 20명 → 7/7/6)
 */
export const seedOf = (i: number, total: number) => Math.floor((i * 3) / total) + 1;

/** Fisher–Yates 셔플 (원본 배열은 건드리지 않음) */
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type TeamMember = { nickname: string; seed: number };

/**
 * 순위표 순서대로 받은 닉네임을 1·2·3시드 한 명씩 묶어 팀을 만든다.
 * 시드별 인원이 다르면(20명 → 7/7/6) 남는 팀은 2인 팀이 된다.
 */
export function shuffleTeams(nicknames: string[]): TeamMember[][] {
  const groups: TeamMember[][] = [[], [], []];
  nicknames.forEach((nickname, i) => {
    const seed = seedOf(i, nicknames.length);
    groups[seed - 1].push({ nickname, seed });
  });
  const [s1, s2, s3] = groups.map(shuffle);
  const teamCount = Math.max(s1.length, s2.length, s3.length);
  return Array.from({ length: teamCount }, (_, t) =>
    [s1[t], s2[t], s3[t]].filter((m): m is TeamMember => m !== undefined)
  );
}
