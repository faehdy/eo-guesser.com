import { NextResponse } from "next/server";
import { generateLandCoordinate } from "@/lib/landmass";

const STAC_SEARCH_URL =
  "https://planetarycomputer.microsoft.com/api/stac/v1/search";

interface StacItem {
  id: string;
  geometry: {
    coordinates: number[][][];
  };
  properties: {
    datetime: string;
    "eo:cloud_cover": number;
  };
  assets: {
    rendered_preview?: { href: string };
    visual?: { href: string };
    B04?: { href: string };
  };
  links: Array<{ rel: string; href: string }>;
}

interface StacSearchResponse {
  features: StacItem[];
}

/**
 * Builds a bounding box of approximately ±0.05° (~5 km) around the given point.
 */
function buildBbox(
  lng: number,
  lat: number
): [number, number, number, number] {
  const delta = 0.05;
  return [lng - delta, lat - delta, lng + delta, lat + delta];
}

/**
 * Queries the Microsoft Planetary Computer STAC API for Sentinel-2 L2A imagery.
 * Returns a rendered preview URL and metadata, or null if nothing suitable found.
 */
async function fetchSentinel2Item(
  lng: number,
  lat: number
): Promise<{
  imageUrl: string;
  date: string;
  cloudCover: number;
  itemId: string;
} | null> {
  const bbox = buildBbox(lng, lat);

  // Search the past 2 years for cloud-free imagery
  const now = new Date();
  const twoYearsAgo = new Date(now);
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const datetime = `${twoYearsAgo.toISOString().split("T")[0]}/${now.toISOString().split("T")[0]}`;

  const body = {
    collections: ["sentinel-2-l2a"],
    bbox,
    datetime,
    query: {
      "eo:cloud_cover": { lt: 20 },
    },
    sortby: [{ field: "eo:cloud_cover", direction: "asc" }],
    limit: 5,
  };

  const response = await fetch(STAC_SEARCH_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    next: { revalidate: 0 },
  });

  if (!response.ok) return null;

  const data: StacSearchResponse = await response.json();
  if (!data.features || data.features.length === 0) return null;

  const item = data.features[0];

  // Use the rendered_preview thumbnail provided by Planetary Computer
  const previewHref = item.assets?.rendered_preview?.href;
  if (!previewHref) return null;

  return {
    imageUrl: previewHref,
    date: item.properties.datetime
      ? item.properties.datetime.split("T")[0]
      : "Unknown",
    cloudCover: Math.round(item.properties["eo:cloud_cover"] ?? 0),
    itemId: item.id,
  };
}

export async function GET(): Promise<NextResponse> {
  const MAX_RETRIES = 5;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const [lng, lat] = generateLandCoordinate();
      const result = await fetchSentinel2Item(lng, lat);

      if (result) {
        return NextResponse.json({
          coordinates: [lng, lat] as [number, number],
          imageUrl: result.imageUrl,
          date: result.date,
          cloudCover: result.cloudCover,
          itemId: result.itemId,
        });
      }
    } catch (err) {
      // Log error and retry with a different location
      console.error(`get-location attempt ${attempt + 1} failed:`, err);
      continue;
    }
  }

  return NextResponse.json(
    { error: "Could not find a suitable Sentinel-2 image after several tries." },
    { status: 503 }
  );
}
