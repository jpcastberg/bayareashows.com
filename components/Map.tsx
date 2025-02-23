"use client";
import { useState, useEffect } from "react";
import { LatLngExpression } from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { Show } from "@/models/Show";

const position: LatLngExpression = [37.7854, -122.48414];
export default function Map() {
    const [shows, setShows] = useState<Show[]>([]);
    useEffect(() => {
        async function fetchData() {
          try {
            const response = await fetch("/parsed.json");
            if (!response.ok) {
              throw new Error("Failed to fetch");
            }
            const data = await response.json();
            setShows(data.shows);
          } catch (err) {
            console.error(err);
          }
        }

        fetchData();
      }, []);
    return (
        <div>
            <MapContainer style={{height: "100vh"}} center={position} zoom={13} scrollWheelZoom={false}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png?api_key=2982d201-dc92-4bbd-8397-570ca544a08d"
                />
                {shows.map((show) => (
                    <Marker key={show.id} position={[show.lat, show.lng]}>
                        <Popup>
                            {show.date} :: {show.bands.join(", ")} :: {show.details.raw}
                        </Popup>
                    </Marker>

                ))}
            </MapContainer>
        </div>
    );
}
