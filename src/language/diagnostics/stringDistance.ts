export function levenshteinDistance(a: string, b: string): number {
  const lower = (s: string): string => s.toLowerCase();
  const x = lower(a);
  const y = lower(b);
  if (x === y) return 0;
  if (x.length === 0) return y.length;
  if (y.length === 0) return x.length;
  let prev = new Array(y.length + 1);
  let curr = new Array(y.length + 1);
  for (let j = 0; j <= y.length; j++) prev[j] = j;
  for (let i = 1; i <= x.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= y.length; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[y.length];
}
