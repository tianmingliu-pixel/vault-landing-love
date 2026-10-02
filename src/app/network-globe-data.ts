import type { Medium } from "./network-topology";

export const cities = [
  { id: "newyork", label: "New York", lat: 40.7, lon: -74.0 },
  { id: "losangeles", label: "Los Angeles", lat: 34.0, lon: -118.2 },
  { id: "london", label: "London", lat: 51.5, lon: -0.1 },
  { id: "frankfurt", label: "Frankfurt", lat: 50.1, lon: 8.7 },
  { id: "marseille", label: "Marseille", lat: 43.3, lon: 5.4 },
  { id: "mumbai", label: "Mumbai", lat: 19.1, lon: 72.9 },
  { id: "singapore", label: "Singapore", lat: 1.3, lon: 103.8 },
  { id: "tokyo", label: "Tokyo", lat: 35.7, lon: 139.7 },
  { id: "sydney", label: "Sydney", lat: -33.9, lon: 151.2 },
  { id: "saopaulo", label: "São Paulo", lat: -23.6, lon: -46.6 },
] as const;

export type CityId = (typeof cities)[number]["id"];

export const cityLinks = [
  { id: "ny-london", from: "newyork", to: "london", medium: "wired" },
  { id: "ny-la", from: "newyork", to: "losangeles", medium: "wired" },
  { id: "la-tokyo", from: "losangeles", to: "tokyo", medium: "wired" },
  { id: "tokyo-singapore", from: "tokyo", to: "singapore", medium: "wired" },
  { id: "singapore-mumbai", from: "singapore", to: "mumbai", medium: "wired" },
  { id: "mumbai-marseille", from: "mumbai", to: "marseille", medium: "wired" },
  { id: "marseille-frankfurt", from: "marseille", to: "frankfurt", medium: "wired" },
  { id: "london-frankfurt", from: "london", to: "frankfurt", medium: "wired" },
  { id: "singapore-sydney", from: "singapore", to: "sydney", medium: "wired" },
  { id: "ny-saopaulo", from: "newyork", to: "saopaulo", medium: "wired" },
  { id: "sydney-saopaulo", from: "sydney", to: "saopaulo", medium: "wireless" },
  { id: "mumbai-sydney", from: "mumbai", to: "sydney", medium: "wireless" },
] as const satisfies readonly { id: string; from: CityId; to: CityId; medium: Medium }[];

export type CityLinkId = (typeof cityLinks)[number]["id"];

export const cityNote = "City-to-city routes are an illustrative regional topology, not a live map of any specific operator's real cable landings.";
