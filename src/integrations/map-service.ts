import { getRouteContext as getMockRouteContext } from "./mock.js";

export type Coordinate = [number, number];

export interface DestinationSuggestion {
  id: string;
  name: string;
  address: string;
  fullAddress: string;
}

export interface RouteResult {
  provider: "mapbox" | "mock";
  destination: string;
  origin: Coordinate;
  destinationCoordinate: Coordinate;
  geometry: { type: "LineString"; coordinates: Coordinate[] };
  distanceMeters: number;
  durationSeconds: number;
  typicalDurationSeconds: number | null;
  remainingMinutes: number;
  eta: string;
  congestion: string;
  roadSummary: string;
}

export interface MapService {
  suggest(query: string, sessionToken: string, proximity?: Coordinate): Promise<DestinationSuggestion[]>;
  retrieve(id: string, sessionToken: string): Promise<{ name: string; address: string; coordinate: Coordinate }>;
  directions(origin: Coordinate, destination: Coordinate, destinationName?: string): Promise<RouteResult>;
}

const mockOrigin: Coordinate = [-122.2711, 37.8044];
const mockDestination: Coordinate = [-122.3999, 37.7936];
const mockGeometry: Coordinate[] = [
  mockOrigin, [-122.287, 37.813], [-122.322, 37.822], [-122.354, 37.817], [-122.383, 37.803], mockDestination,
];

function mockRoute(origin = mockOrigin, destination = mockDestination, destinationName = "Work"): RouteResult {
  const durationSeconds = 102 * 60;
  return {
    provider: "mock", destination: destinationName, origin, destinationCoordinate: destination,
    geometry: { type: "LineString", coordinates: mockGeometry }, distanceMeters: 23800,
    durationSeconds, typicalDurationSeconds: 92 * 60, remainingMinutes: 102,
    eta: new Date(Date.now() + durationSeconds * 1000).toISOString(), congestion: "moderate", roadSummary: "I-80 W",
  };
}

export class MockMapService implements MapService {
  async suggest(query: string, _sessionToken: string, _proximity?: Coordinate): Promise<DestinationSuggestion[]> {
    return query.trim() ? [{ id: "mock-work", name: "Work", address: "Market Street", fullAddress: "Market Street, San Francisco, CA" }] : [];
  }
  async retrieve(_id: string, _sessionToken: string): Promise<{ name: string; address: string; coordinate: Coordinate }> {
    return { name: "Work", address: "Market Street, San Francisco, CA", coordinate: mockDestination };
  }
  async directions(origin: Coordinate, destination: Coordinate, destinationName?: string): Promise<RouteResult> {
    await getMockRouteContext("demo-user", destinationName);
    return mockRoute(origin, destination, destinationName);
  }
}

export class MapboxMapService implements MapService {
  constructor(private readonly token: string) {}

  async suggest(query: string, sessionToken: string, proximity?: Coordinate): Promise<DestinationSuggestion[]> {
    const params = new URLSearchParams({ q: query.slice(0, 256), session_token: sessionToken, access_token: this.token, limit: "5", language: "en" });
    if (proximity) params.set("proximity", `${proximity[0]},${proximity[1]}`);
    const response = await fetch(`https://api.mapbox.com/search/searchbox/v1/suggest?${params}`);
    if (!response.ok) throw new Error(`Mapbox Search Box suggest returned ${response.status}`);
    const data = await response.json() as any;
    return (data?.suggestions ?? []).map((item: any) => ({
      id: item.mapbox_id,
      name: item.name ?? item.name_preferred ?? "Destination",
      address: item.address ?? item.place_formatted ?? "",
      fullAddress: [item.address, item.place_formatted].filter(Boolean).join(", "),
    })).filter((item: DestinationSuggestion) => item.id);
  }

  async retrieve(id: string, sessionToken: string): Promise<{ name: string; address: string; coordinate: Coordinate }> {
    const params = new URLSearchParams({ session_token: sessionToken, access_token: this.token });
    const response = await fetch(`https://api.mapbox.com/search/searchbox/v1/retrieve/${encodeURIComponent(id)}?${params}`);
    if (!response.ok) throw new Error(`Mapbox Search Box retrieve returned ${response.status}`);
    const feature = ((await response.json()) as any)?.features?.[0];
    const coordinate = feature?.geometry?.coordinates as Coordinate | undefined;
    if (!coordinate || coordinate.length !== 2) throw new Error("Mapbox retrieve returned no coordinate");
    const properties = feature.properties ?? {};
    return {
      name: properties.name ?? properties.name_preferred ?? "Destination",
      address: properties.full_address ?? [properties.address, properties.place_formatted].filter(Boolean).join(", "),
      coordinate,
    };
  }

  async directions(origin: Coordinate, destination: Coordinate, destinationName = "Destination"): Promise<RouteResult> {
    const coordinates = `${origin[0]},${origin[1]};${destination[0]},${destination[1]}`;
    const params = new URLSearchParams({
      access_token: this.token, geometries: "geojson", overview: "full", steps: "false",
      annotations: "congestion,duration,distance", alternatives: "false",
    });
    const response = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving-traffic/${coordinates}?${params}`);
    if (!response.ok) throw new Error(`Mapbox Directions returned ${response.status}`);
    const route = ((await response.json()) as any)?.routes?.[0];
    if (!route?.geometry?.coordinates || typeof route.duration !== "number") throw new Error("Mapbox Directions returned no route");
    const durationSeconds = Math.round(route.duration);
    const congestionValues = route.legs?.flatMap((leg: any) => leg.annotation?.congestion ?? []) ?? [];
    const congestion = congestionValues.includes("severe") || congestionValues.includes("heavy") ? "heavy"
      : congestionValues.includes("moderate") ? "moderate" : "light";
    return {
      provider: "mapbox", destination: destinationName, origin, destinationCoordinate: destination,
      geometry: route.geometry, distanceMeters: Math.round(route.distance), durationSeconds,
      typicalDurationSeconds: typeof route.duration_typical === "number" ? Math.round(route.duration_typical) : null,
      remainingMinutes: Math.max(1, Math.ceil(durationSeconds / 60)),
      eta: new Date(Date.now() + durationSeconds * 1000).toISOString(), congestion,
      roadSummary: route.legs?.map((leg: any) => leg.summary).filter(Boolean).join(" · ") || "Fastest route",
    };
  }
}

const mock = new MockMapService();

export function getMapService(): MapService {
  const token = process.env.MAPBOX_ACCESS_TOKEN ?? process.env.MAPBOX_PUBLIC_TOKEN;
  return token ? new MapboxMapService(token) : mock;
}

export function mapboxPublicToken(): string | null {
  const token = process.env.MAPBOX_PUBLIC_TOKEN ?? process.env.MAPBOX_ACCESS_TOKEN;
  return token?.startsWith("pk.") ? token : null;
}

export async function withMapFallback<T>(action: (service: MapService) => Promise<T>, fallback: () => Promise<T>): Promise<T> {
  try { return await action(getMapService()); }
  catch (error) {
    console.warn(`[integrations] Mapbox unavailable; using mock map fallback (${(error as Error).message})`);
    return fallback();
  }
}

export const mockMapService = mock;
