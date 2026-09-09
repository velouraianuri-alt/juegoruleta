// Pure derivations from a settled number, shared by the results-history strip and
// its full-detail dialog. Mirrors the win conditions in fn_settle_roulette_round
// (dozen/column indexing, parity) so the displayed labels always agree with how a
// bet on that spot would actually have resolved.
export function parityLabel(n: number): "Par" | "Impar" | "—" {
  if (n === 0) return "—";
  return n % 2 === 0 ? "Par" : "Impar";
}

export function rangeLabel(n: number): "1–18" | "19–36" | "—" {
  if (n === 0) return "—";
  return n <= 18 ? "1–18" : "19–36";
}

export function dozenLabel(n: number): "1ª" | "2ª" | "3ª" | "—" {
  if (n === 0) return "—";
  if (n <= 12) return "1ª";
  if (n <= 24) return "2ª";
  return "3ª";
}

export function columnLabel(n: number): "1" | "2" | "3" | "—" {
  if (n === 0) return "—";
  const mod = n % 3;
  if (mod === 1) return "1";
  if (mod === 2) return "2";
  return "3";
}
