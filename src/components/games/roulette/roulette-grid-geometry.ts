// Pure layout math for the number grid's split/corner hit-zones — kept separate
// from betting-grid.tsx so the geometry (which must exactly match
// fn_valid_roulette_split/fn_valid_roulette_corner server-side) is easy to audit
// on its own. Number n sits at column ((n-1)/3)+1, position ((n-1)%3)+1 within
// that column (1=bottom row, 3=top row) — see the migration for the full
// explanation. NUMBER_ROWS below is that same topology, just indexed by UI
// row/col instead of by the column/position pair the server uses.
export const GRID_COLS = 12;
export const GRID_ROWS = 3;

export const NUMBER_ROWS = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
];

export interface HitZone {
  key: string;
  type: "split" | "corner";
  numbers: number[];
  xPct: number;
  yPct: number;
}

const sortNums = (nums: number[]) => [...nums].sort((a, b) => a - b);

export function buildHitZones(): HitZone[] {
  const zones: HitZone[] = [];

  for (let r = 0; r < GRID_ROWS - 1; r++) {
    for (let c = 0; c < GRID_COLS; c++) {
      zones.push({
        key: `v-${c}-${r}`,
        type: "split",
        numbers: sortNums([NUMBER_ROWS[r][c], NUMBER_ROWS[r + 1][c]]),
        xPct: ((c + 0.5) / GRID_COLS) * 100,
        yPct: ((r + 1) / GRID_ROWS) * 100,
      });
    }
  }

  for (let r = 0; r < GRID_ROWS; r++) {
    for (let c = 0; c < GRID_COLS - 1; c++) {
      zones.push({
        key: `h-${c}-${r}`,
        type: "split",
        numbers: sortNums([NUMBER_ROWS[r][c], NUMBER_ROWS[r][c + 1]]),
        xPct: ((c + 1) / GRID_COLS) * 100,
        yPct: ((r + 0.5) / GRID_ROWS) * 100,
      });
    }
  }

  for (let r = 0; r < GRID_ROWS - 1; r++) {
    for (let c = 0; c < GRID_COLS - 1; c++) {
      zones.push({
        key: `c-${c}-${r}`,
        type: "corner",
        numbers: sortNums([
          NUMBER_ROWS[r][c],
          NUMBER_ROWS[r][c + 1],
          NUMBER_ROWS[r + 1][c],
          NUMBER_ROWS[r + 1][c + 1],
        ]),
        xPct: ((c + 1) / GRID_COLS) * 100,
        yPct: ((r + 1) / GRID_ROWS) * 100,
      });
    }
  }

  return zones;
}
