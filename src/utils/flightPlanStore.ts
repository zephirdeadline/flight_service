export interface Waypoint {
  lat: number;
  lon: number;
  name: string;
  note?: string;
  elevationM?: number;
}

const FLIGHT_PLAN_KEY = 'flightPlan';

export let flightPlanModule: Waypoint[] = (() => {
  try {
    const saved = localStorage.getItem(FLIGHT_PLAN_KEY);
    return saved ? (JSON.parse(saved) as Waypoint[]) : [];
  } catch {
    return [];
  }
})();

export const saveFlightPlan = (plan: Waypoint[]) => {
  flightPlanModule = plan;
  try { localStorage.setItem(FLIGHT_PLAN_KEY, JSON.stringify(plan)); } catch {}
};
