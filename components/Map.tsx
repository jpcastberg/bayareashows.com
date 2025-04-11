"use client";
import { useState, useEffect } from "react";
import { LatLngExpression } from "leaflet";
import { MapContainer, TileLayer } from "react-leaflet";
import { Venue } from "@/models";
import { get } from "@/ts/api";
import VenueMarker from "@/components/VenueMarker";

const position: LatLngExpression = [37.7854, -122.48414];
export default function Map() {
    const [venues, setVenues] = useState<Venue[]>([]);
    useEffect(() => {
        get("/api/shows").then((data) => {
            const typedData = data as Record<string, Venue[]>;
            setVenues(typedData.venues);
        });
    }, []);
    return (
        <div>
            <MapContainer
                style={{ height: "100vh" }}
                center={position}
                zoom={13}
                scrollWheelZoom={false}>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}.png?api_key=2982d201-dc92-4bbd-8397-570ca544a08d"
                />
                {venues.map((venue) => (
                    <VenueMarker venue={venue} key={venue.id}></VenueMarker>
                ))}
            </MapContainer>
        </div>
    );
}
