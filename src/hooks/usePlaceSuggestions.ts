import type { Player, ExpectedAttendee } from '../types';
import { DEFAULT_PLACE } from '../lib/constants';

/** Every place used before (payments + expected), "الجيم" first. */
export function usePlaceSuggestions(players: Player[], expected: ExpectedAttendee[] = []): string[] {
  const set = new Set<string>([DEFAULT_PLACE]);
  players.forEach(p => p.history?.forEach(h => h.place && set.add(h.place)));
  expected.forEach(e => e.place && set.add(e.place));
  return [...set];
}
