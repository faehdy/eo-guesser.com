"use client";

import { useState } from "react";

export default function InfoButton() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Info Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="px-3 py-1 text-sm rounded-lg bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700"
        aria-label="Info & Attribution"
      >
        ℹ️ Info
      </button>

      {/* Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-gray-900 rounded-xl p-6 max-w-lg w-full border border-gray-800 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-2xl font-bold text-emerald-400 mb-4">
              🛰 EO Guesser
            </h2>

            <div className="space-y-4 text-sm text-gray-300">
              <p>
                Guess the location based on satellite imagery from space!
              </p>

              <div>
                <h3 className="font-semibold text-white mb-2">Data Sources & Attribution</h3>
                <ul className="space-y-2 text-xs">
                  <li>
                    <strong className="text-emerald-400">Satellite Imagery:</strong>{" "}
                    <a
                      href="https://sentinel.esa.int/web/sentinel/missions/sentinel-2"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      Copernicus Sentinel-2
                    </a>{" "}
                    - Contains modified Copernicus Sentinel data, processed by ESA
                  </li>
                  <li>
                    <strong className="text-emerald-400">Map Tiles:</strong> ©{" "}
                    <a
                      href="https://www.openstreetmap.org/copyright"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      OpenStreetMap
                    </a>{" "}
                    contributors
                  </li>
                  <li>
                    <strong className="text-emerald-400">Land Boundaries:</strong>{" "}
                    <a
                      href="https://www.naturalearthdata.com/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline"
                    >
                      Natural Earth
                    </a>{" "}
                    (Public Domain)
                  </li>
                </ul>
              </div>

              <div className="pt-2 border-t border-gray-800 text-xs text-gray-500">
                <p>
                  This game uses freely available Earth observation data to help
                  people learn about our planet.
                </p>
              </div>
            </div>

            <button
              onClick={() => setIsOpen(false)}
              className="mt-6 w-full py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 font-semibold transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
