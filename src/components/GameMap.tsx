"use client";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Polyline,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet's default icon paths broken by Webpack/Next.js bundling
function fixLeafletIcons() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete (L.Icon.Default.prototype as any)._getIconUrl;
  L.Icon.Default.mergeOptions({
    iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
    iconRetinaUrl:
      "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
    shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  });
}

const guessIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const actualIcon = new L.Icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface ClickHandlerProps {
  onMapClick: (latlng: L.LatLng) => void;
  enabled: boolean;
}

function ClickHandler({ onMapClick, enabled }: ClickHandlerProps) {
  useMapEvents({
    click(e) {
      if (enabled) {
        onMapClick(e.latlng);
      }
    },
  });
  return null;
}

export interface GameMapProps {
  guessLatLng: L.LatLng | null;
  actualLatLng: [number, number] | null;
  onMapClick: (latlng: L.LatLng) => void;
  revealed: boolean;
}

export default function GameMap({
  guessLatLng,
  actualLatLng,
  onMapClick,
  revealed,
}: GameMapProps) {
  useEffect(() => {
    fixLeafletIcons();
  }, []);

  const polylinePositions: [number, number][] =
    revealed && guessLatLng && actualLatLng
      ? [
          [guessLatLng.lat, guessLatLng.lng],
          [actualLatLng[1], actualLatLng[0]],
        ]
      : [];

  return (
    <MapContainer
      center={[20, 0]}
      zoom={2}
      style={{ height: "100%", width: "100%" }}
      className="rounded-xl"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <ClickHandler onMapClick={onMapClick} enabled={!revealed} />

      {guessLatLng && (
        <Marker position={guessLatLng} icon={guessIcon} />
      )}

      {revealed && actualLatLng && (
        <Marker
          position={[actualLatLng[1], actualLatLng[0]]}
          icon={actualIcon}
        />
      )}

      {polylinePositions.length === 2 && (
        <Polyline
          positions={polylinePositions}
          pathOptions={{ color: "#ef4444", weight: 3, dashArray: "8 4" }}
        />
      )}
    </MapContainer>
  );
}
