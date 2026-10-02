/** One simulated clock shared by every view of the satellite layer, so the main globe and the
    ground-station view move at the same speed (real time, ×60, ×600). */
export type SimClock = { now: () => Date; speed: () => number; setSpeed: (speed: number) => void };

export function createSimClock(): SimClock {
  let anchorReal = Date.now();
  let anchorSim = anchorReal;
  let rate = 1;
  return {
    now: () => new Date(anchorSim + (Date.now() - anchorReal) * rate),
    speed: () => rate,
    setSpeed(next) {
      // Re-anchor so changing speed never makes the simulated time jump.
      const current = anchorSim + (Date.now() - anchorReal) * rate;
      anchorReal = Date.now();
      anchorSim = current;
      rate = next;
    },
  };
}

/** Real time, for views that are not part of the simulation. */
export const realClock: SimClock = { now: () => new Date(), speed: () => 1, setSpeed: () => undefined };
