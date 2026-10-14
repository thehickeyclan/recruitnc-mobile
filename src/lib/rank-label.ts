/**
 * "RecruitNC #4" on the men's board, "RecruitNC Women's #4" on the women's.
 *
 * The two boards share class years and numbers, so a bare "#4" on a girl's profile reads as the
 * men's #4. Kept free of react-native imports so the scouting report HTML can use it in tests.
 */
export function rankLabel(rank: number, gender: unknown): string {
  return /female|women|girls/i.test(String(gender ?? "")) ? `RecruitNC Women's #${rank}` : `RecruitNC #${rank}`
}
