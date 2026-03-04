"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import type L from "leaflet";
import { calculateDistance, calculateScore, formatDistance } from "@/lib/scoring";

// Leaflet must only be rendered client-side (it uses window)
const GameMap = dynamic(() => import("@/components/GameMap"), { ssr: false });

type GameState = "loading" | "guessing" | "revealed";

interface LocationData {
  coordinates: [number, number];
  imageUrl: string;
  date: string;
  cloudCover: number;
  itemId: string;
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
  const imgRef = useRef<HTMLImageElement>(null);

  const fetchLocation = useCallback(async () => {
    setGameState("loading");
    setGuessLatLng(null);
    setScore(null);
    setDistanceKm(null);
    setError(null);
    setZoom(false);

    try {
      const res = await fetch("/api/get-location");
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

  // Start first round on mount
  useEffect(() => {
    fetchLocation();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
    fetchLocation();
  }, [fetchLocation]);

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
        <div className="text-sm font-semibold text-yellow-300">
          Score: {totalScore.toLocaleString()}
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
                    onClick={fetchLocation}
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
                alt="Sentinel-2 satellite image"
                className={`max-h-full max-w-full object-contain cursor-zoom-in transition-transform duration-300 ${
                  zoom ? "scale-[2.5] cursor-zoom-out" : ""
                }`}
                onClick={() => setZoom((z) => !z)}
              />
              <div className="absolute bottom-2 left-2 bg-black/60 rounded-lg px-2 py-1 text-xs text-gray-300 backdrop-blur-sm">
                📅 {location.date} &nbsp;☁️ {location.cloudCover}% cloud cover
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
    </div>
  );
}
