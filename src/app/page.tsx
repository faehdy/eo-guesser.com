"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import dynamic from "next/dynamic";
import type L from "leaflet";
import { calculateDistance, calculateScore, formatDistance } from "@/lib/scoring";
import InfoButton from "@/components/InfoButton";

// Leaflet must only be rendered client-side (it uses window)
const GameMap = dynamic(() => import("@/components/GameMap"), { ssr: false });

type GameState = "loading" | "guessing" | "revealed";
type ImageryMode = "optical" | "sar";

interface LocationData {
  coordinates: [number, number];
  imageUrl: string;
  date: string;
  cloudCover: number | null;
  itemId: string;
  mode: ImageryMode;
}

const IMAGE_BBOX_WIDTH_DEGREES = 0.1; // API requests ±0.05° around center
const ZOOM_FACTOR = 2.5;

function roundScaleDistanceKm(distanceKm: number): number {
  if (distanceKm <= 0) return 0;
  const exponent = Math.floor(Math.log10(distanceKm));
  const base = distanceKm / 10 ** exponent;

  let roundedBase = 1;
  if (base >= 5) roundedBase = 5;
  else if (base >= 2) roundedBase = 2;

  return roundedBase * 10 ** exponent;
}

function formatScaleDistance(distanceKm: number): string {
  if (distanceKm >= 1) {
    return `${distanceKm >= 10 ? Math.round(distanceKm) : distanceKm.toFixed(1)} km`;
  }

  const meters = distanceKm * 1000;
  return `${Math.round(meters)} m`;
}

export default function Home() {
  const [gameState, setGameState] = useState<GameState>("loading");
  const [location, setLocation] = useState<LocationData | null>(null);
  const [guessLatLng, setGuessLatLng] = useState<L.LatLng | null>(null);
  const [score, setScore] = useState<number | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [round, setRound] = useState(1);
  const [zoom, setZoom] = useState(false);
  const [imageryMode, setImageryMode] = useState<ImageryMode>("optical");
  const [showModeDialog, setShowModeDialog] = useState(true);
  const [imageWidthPx, setImageWidthPx] = useState<number>(0);
  const imgRef = useRef<HTMLImageElement>(null);

  const updateImageWidth = useCallback(() => {
    if (!imgRef.current) return;
    setImageWidthPx(imgRef.current.clientWidth);
  }, []);

  const fetchLocation = useCallback(async (mode: ImageryMode) => {
    setGameState("loading");
    setGuessLatLng(null);
    setScore(null);
    setDistanceKm(null);
    setError(null);
    setZoom(false);

    try {
      const res = await fetch(`/api/get-location?mode=${mode}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data: LocationData = await res.json();
      if ("error" in data) throw new Error((data as unknown as { error: string }).error);
      setLocation(data);
      setGameState("guessing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load location");
      setGameState("loading");
    }
  }, []);

  const handleMapClick = useCallback((latlng: L.LatLng) => {
    if (gameState === "guessing") {
      setGuessLatLng(latlng);
    }
  }, [gameState]);

  const handleMakeGuess = useCallback(() => {
    if (!guessLatLng || !location) return;
    const dist = calculateDistance(
      [guessLatLng.lng, guessLatLng.lat],
      location.coordinates
    );
    const pts = calculateScore(dist);
    setDistanceKm(dist);
    setScore(pts);
    setTotalScore((prev) => prev + pts);
    setGameState("revealed");
  }, [guessLatLng, location]);

  const handleNextRound = useCallback(() => {
    setRound((r) => r + 1);
    fetchLocation(imageryMode);
  }, [fetchLocation, imageryMode]);

  const handleModeChange = useCallback((mode: ImageryMode) => {
    if (mode === imageryMode) return;
    setImageryMode(mode);
    setRound(1);
    setTotalScore(0);
    fetchLocation(mode);
  }, [fetchLocation, imageryMode]);

  const handleStartWithMode = useCallback((mode: ImageryMode) => {
    setImageryMode(mode);
    setRound(1);
    setTotalScore(0);
    setShowModeDialog(false);
    fetchLocation(mode);
  }, [fetchLocation]);

  useEffect(() => {
    window.addEventListener("resize", updateImageWidth);
    return () => window.removeEventListener("resize", updateImageWidth);
  }, [updateImageWidth]);

  const imageScale = useMemo(() => {
    if (!location || imageWidthPx <= 0) return null;

    const latDeg = location.coordinates[1];
    const kmPerDegreeLon = 111.32 * Math.cos((latDeg * Math.PI) / 180);
    const footprintWidthKm = Math.max(0, kmPerDegreeLon * IMAGE_BBOX_WIDTH_DEGREES);
    if (!Number.isFinite(footprintWidthKm) || footprintWidthKm <= 0) return null;

    const visibleImageWidthPx = imageWidthPx * (zoom ? ZOOM_FACTOR : 1);
    const kmPerPx = footprintWidthKm / visibleImageWidthPx;
    if (!Number.isFinite(kmPerPx) || kmPerPx <= 0) return null;

    const targetBarPx = 100;
    const rawDistanceKm = kmPerPx * targetBarPx;
    const roundedDistanceKm = roundScaleDistanceKm(rawDistanceKm);
    const barWidthPx = roundedDistanceKm / kmPerPx;

    return {
      label: formatScaleDistance(roundedDistanceKm),
      widthPx: Math.max(40, Math.min(180, barWidthPx)),
    };
  }, [location, imageWidthPx, zoom]);

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white">
      {/* Header */}
      <header className="flex items-center justify-between px-4 py-2 bg-gray-900 border-b border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xl font-bold tracking-tight text-emerald-400">
            🛰 EO Guesser
          </span>
          <span className="text-sm text-gray-400">Round {round}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border border-gray-700 overflow-hidden text-xs">
            <button
              onClick={() => handleModeChange("optical")}
              className={`px-2 py-1 transition-colors ${
                imageryMode === "optical"
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
              aria-pressed={imageryMode === "optical"}
            >
              Optical
            </button>
            <button
              onClick={() => handleModeChange("sar")}
              className={`px-2 py-1 transition-colors ${
                imageryMode === "sar"
                  ? "bg-emerald-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
              aria-pressed={imageryMode === "sar"}
            >
              SAR
            </button>
          </div>
          <div className="text-sm font-semibold text-yellow-300">
            Score: {totalScore.toLocaleString()}
          </div>
          <InfoButton />
        </div>
      </header>

      {/* Main content */}
      <main className="flex flex-1 overflow-hidden flex-col lg:flex-row gap-2 p-2">
        {/* Satellite image panel */}
        <div className="flex-1 relative bg-black rounded-xl overflow-hidden flex items-center justify-center min-h-48">
          {gameState === "loading" && (
            <div className="flex flex-col items-center gap-3 text-gray-400">
              <svg
                className="animate-spin h-10 w-10 text-emerald-400"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v8H4z"
                />
              </svg>
              <span>Loading satellite image…</span>
              {error && (
                <div className="text-red-400 text-sm max-w-xs text-center">
                  {error}
                  <button
                    onClick={() => fetchLocation(imageryMode)}
                    className="block mt-2 px-4 py-1 bg-emerald-600 rounded-lg text-white text-sm hover:bg-emerald-700"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
          )}

          {location && gameState !== "loading" && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                ref={imgRef}
                src={location.imageUrl}
                alt={location.mode === "sar" ? "Sentinel-1 SAR image" : "Sentinel-2 satellite image"}
                className={`max-h-full max-w-full object-contain cursor-zoom-in transition-transform duration-300 ${
                  zoom ? "scale-[2.5] cursor-zoom-out" : ""
                }`}
                onLoad={updateImageWidth}
                onClick={() => setZoom((z) => !z)}
              />
              {imageScale && (
                <div className="absolute top-2 left-2 bg-black/60 rounded-lg px-2 py-1 text-xs text-gray-200 backdrop-blur-sm">
                  <div
                    className="h-1 bg-gray-100 rounded"
                    style={{ width: `${imageScale.widthPx}px` }}
                  />
                  <div className="mt-1">~ {imageScale.label}</div>
                </div>
              )}
              <div className="absolute bottom-2 left-2 bg-black/60 rounded-lg px-2 py-1 text-xs text-gray-300 backdrop-blur-sm">
                {location.mode === "sar"
                  ? `📡 Radar date: ${location.date}`
                  : `📅 ${location.date}  ☁️ ${location.cloudCover ?? 0}% cloud cover`}
              </div>
              <div className="absolute top-2 right-2 bg-black/60 rounded-lg px-2 py-1 text-xs text-gray-400 backdrop-blur-sm">
                Click image to zoom
              </div>
            </>
          )}
        </div>

        {/* Map + controls panel */}
        <div className="flex flex-col gap-2 w-full lg:w-96 shrink-0">
          {/* Leaflet map */}
          <div className="flex-1 rounded-xl overflow-hidden min-h-64">
            <GameMap
              guessLatLng={guessLatLng}
              actualLatLng={gameState === "revealed" ? location?.coordinates ?? null : null}
              onMapClick={handleMapClick}
              revealed={gameState === "revealed"}
            />
          </div>

          {/* Controls */}
          <div className="bg-gray-900 rounded-xl p-3 space-y-2 shrink-0">
            {gameState === "guessing" && (
              <>
                <p className="text-sm text-gray-400">
                  {guessLatLng
                    ? "📍 Marker placed — ready to submit!"
                    : "Click the map to place your guess"}
                </p>
                <button
                  onClick={handleMakeGuess}
                  disabled={!guessLatLng}
                  className="w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-700 disabled:text-gray-500 font-semibold transition-colors"
                >
                  Make Guess
                </button>
              </>
            )}

            {gameState === "revealed" && (
              <>
                <div className="text-center space-y-1">
                  <div className="text-2xl font-bold text-yellow-300">
                    {score?.toLocaleString()} pts
                  </div>
                  <div className="text-sm text-gray-400">
                    Distance: {distanceKm !== null ? formatDistance(distanceKm) : "—"}
                  </div>
                  <div className="text-xs text-gray-500">
                    📌 Actual:{" "}
                    {location?.coordinates[1].toFixed(4)}°,{" "}
                    {location?.coordinates[0].toFixed(4)}°
                  </div>
                </div>
                <button
                  onClick={handleNextRound}
                  className="w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 font-semibold transition-colors"
                >
                  Next Round →
                </button>
              </>
            )}
          </div>
        </div>
      </main>

      {showModeDialog && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-gray-900 border border-gray-700 rounded-2xl p-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-emerald-400">Disclaimer and Choose Imagery Mode</h2>
            <p className="mt-2 text-sm text-gray-300">
              This game is a hobbie project and still in the alpha testing phase. The satellite images are randomly fetched from the Sentinel-1 (SAR) and Sentinel-2 (optical) missions, so you might occasionally encounter locations that are hard to guess or have less interesting visuals.
              <br />
              <br />

              Select a mode to start your round. You can switch later in the header.
            </p>
            <p className="mt-2 text-xs text-gray-400">
              Note: Arctic-region locations are intentionally sampled with lower probability.
            </p>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-4">
                <h3 className="font-semibold text-white">Optical (Visual)</h3>
                <p className="mt-2 text-xs text-gray-300">
                  Uses reflected sunlight, similar to natural-color photos. Helpful for
                  recognizing vegetation, coastlines, urban shapes, snow, and deserts.
                </p>
                <button
                  onClick={() => handleStartWithMode("optical")}
                  className="mt-4 w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 font-semibold transition-colors"
                >
                  Start in Optical
                </button>
              </div>

              <div className="rounded-xl border border-gray-700 bg-gray-800/60 p-4">
                <h3 className="font-semibold text-white">SAR (Radar)</h3>
                <p className="mt-2 text-xs text-gray-300">
                  Active microwave sensor that works day/night and through most clouds.
                  Displayed here in grayscale: brighter means stronger backscatter,
                  darker usually means smoother surfaces like calm water.
                </p>
                <button
                  onClick={() => handleStartWithMode("sar")}
                  className="mt-4 w-full py-2 rounded-lg bg-blue-600 hover:bg-blue-700 font-semibold transition-colors"
                >
                  Start in SAR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
