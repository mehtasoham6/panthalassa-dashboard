export type Side = "ocean" | "land";

/** Relative gap below which two figures count as the same. */
const SAME = 5e-4;

/** Which side has the lower figure, or null when they are effectively equal. */
export function lowerSide(ocean: number, land: number): Side | null {
  const scale = Math.max(Math.abs(ocean), Math.abs(land));
  if (scale === 0 || Math.abs(ocean - land) / scale < SAME) return null;
  return ocean < land ? "ocean" : "land";
}

interface HighlightClasses {
  ocean: string;
  land: string;
  worse: string;
}

/** Class for one cell of a two-sided row: the lower figure in its side's colour, the other quiet. */
export function highlightClass(winner: Side | null, side: Side, classes: HighlightClasses): string {
  if (winner === null) return "";
  return winner === side ? classes[side] : classes.worse;
}
