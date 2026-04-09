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
    "eo:cloud_cover"?: number;
  };
  assets: {
    rendered_preview?: { href: string };
    thumbnail?: { href: string };
    visual?: { href: string };
    B04?: { href: string };
    vv?: { href: string };
    vh?: { href: string };
    hh?: { href: string };
    hv?: { href: string };
  };
  links: Array<{ rel: string; href: string }>;
}

interface StacSearchResponse {
  features: StacItem[];
}

type ImageryMode = "optical" | "sar";

interface ImageResult {
  imageUrl: string;
  date: string;
  cloudCover: number | null;
  itemId: string;
  mode: ImageryMode;
}

/**
 * Build a deterministic SAR grayscale preview URL.
 * The selected band is repeated across RGB channels so the output stays grayscale.
 */
function buildSentinel1GrayscalePreview(item: StacItem): string | null {
  const hasVV = Boolean(item.assets?.vv);
  const hasHH = Boolean(item.assets?.hh);
  const hasHV = Boolean(item.assets?.hv);
  const hasVH = Boolean(item.assets?.vh);

  // Prefer co-pol backscatter for stable grayscale tone.
  const band = hasVV ? "vv" : hasHH ? "hh" : hasHV ? "hv" : hasVH ? "vh" : null;

  if (!band) return null;

  const params = new URLSearchParams({
    collection: "sentinel-1-grd",
    item: item.id,
    expression: `${band};${band};${band}`,
    asset_as_band: "true",
    format: "png",
  });

  // Titiler on Planetary Computer expects repeated assets and rescale params.
  params.append("assets", band);
  params.append("rescale", "0,600");
  params.append("rescale", "0,600");
  params.append("rescale", "0,600");

  return `https://planetarycomputer.microsoft.com/api/data/v1/item/preview.png?${params.toString()}`;
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
): Promise<ImageResult | null> {
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
    mode: "optical",
  };
}

/**
 * Queries the Microsoft Planetary Computer STAC API for Sentinel-1 GRD SAR imagery.
 * Returns a preview URL and radar acquisition date metadata, or null if none found.
 */
async function fetchSentinel1Item(
  lng: number,
  lat: number
): Promise<ImageResult | null> {
  const bbox = buildBbox(lng, lat);

  // Search the past 2 years for recent SAR acquisitions
  const now = new Date();
  const twoYearsAgo = new Date(now);
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const datetime = `${twoYearsAgo.toISOString().split("T")[0]}/${now.toISOString().split("T")[0]}`;

  const body = {
    collections: ["sentinel-1-grd"],
    bbox,
    datetime,
    sortby: [{ field: "datetime", direction: "desc" }],
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
  const previewHref =
    buildSentinel1GrayscalePreview(item) ??
    item.assets?.rendered_preview?.href ??
    item.assets?.thumbnail?.href;
  if (!previewHref) return null;

  return {
    imageUrl: previewHref,
    date: item.properties.datetime
      ? item.properties.datetime.split("T")[0]
      : "Unknown",
    cloudCover: null,
    itemId: item.id,
    mode: "sar",
  };
}

function parseMode(modeParam: string | null): ImageryMode {
  return modeParam === "sar" ? "sar" : "optical";
}

export async function GET(request: Request): Promise<NextResponse> {
  const MAX_RETRIES = 5;
  const mode = parseMode(new URL(request.url).searchParams.get("mode"));

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const [lng, lat] = generateLandCoordinate();
      const result =
        mode === "sar"
          ? await fetchSentinel1Item(lng, lat)
          : await fetchSentinel2Item(lng, lat);

      if (result) {
        return NextResponse.json({
          coordinates: [lng, lat] as [number, number],
          imageUrl: result.imageUrl,
          date: result.date,
          cloudCover: result.cloudCover,
          itemId: result.itemId,
          mode: result.mode,
        });
      }
    } catch (err) {
      // Log error and retry with a different location
      console.error(`get-location attempt ${attempt + 1} failed:`, err);
      continue;
    }
  }

  return NextResponse.json(
    {
      error:
        mode === "sar"
          ? "Could not find a suitable Sentinel-1 SAR image after several tries."
          : "Could not find a suitable Sentinel-2 image after several tries.",
    },
    { status: 503 }
  );
}
