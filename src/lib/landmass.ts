import fs from "fs";
import path from "path";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import { point } from "@turf/helpers";
import type { FeatureCollection, Geometry } from "geojson";

// Module-level cache so the file is only read once per cold start
let landGeoJSON: FeatureCollection<Geometry> | null = null;

function getLandGeoJSON(): FeatureCollection<Geometry> {
  if (!landGeoJSON) {
    const filePath = path.join(
      process.cwd(),
      "public",
      "ne_110m_land.geojson"
    );
    const raw = fs.readFileSync(filePath, "utf-8");
    landGeoJSON = JSON.parse(raw) as FeatureCollection<Geometry>;
  }
  return landGeoJSON;
}

/**
 * Generates a random [longitude, latitude] pair that falls on a land mass.
 * Uses turf.js booleanPointInPolygon against the Natural Earth 110m land GeoJSON.
 * Retries until a valid land coordinate is found.
 */
export function generateLandCoordinate(): [number, number] {
  const geoJSON = getLandGeoJSON();

  for (let attempts = 0; attempts < 1000; attempts++) {
    // Avoid polar extremes where Sentinel-2 has limited coverage
    const lng = Math.random() * 360 - 180; // -180 to 180
    const lat = Math.random() * 140 - 60; // -60 to 80

    const pt = point([lng, lat]);

    for (const feature of geoJSON.features) {
      if (
        feature.geometry &&
        (feature.geometry.type === "Polygon" ||
          feature.geometry.type === "MultiPolygon") &&
        booleanPointInPolygon(pt, feature as Parameters<typeof booleanPointInPolygon>[1])
      ) {
        return [lng, lat];
      }
    }
  }

  // Fallback to a known land coordinate (Paris)
  return [2.35, 48.85];
}
