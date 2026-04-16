/**
 * Format a chip value — either as raw chips or as BB multiples.
 */
export function formatChips(value: number, displayInBB: boolean, bigBlind: number): string {
  if (!displayInBB || bigBlind <= 0) return String(value);
  const bb = Math.round((value / bigBlind) * 10) / 10;
  return `${bb % 1 === 0 ? bb.toFixed(0) : bb.toFixed(1)} ББ`;
}
