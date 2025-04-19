import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { Venue } from "@/models";
import styles from "./VenueMarker.module.css";

export default function VenueMarker({ venue }: { venue: Venue }) {
    const customIcon = L.divIcon({
        className: styles["venue-marker"],
        html: `
            <img class="${styles["venue-image"]}" src="${venue.photo}" alt="${venue.name}" title="${venue.name}" onerror="this.onerror = null; this.src = '/images/concert.jpg'" />
        `,
        iconSize: [48, 48], // Adjust size as needed
        // iconAnchor: [16, 48], // Anchor point to center the icon
        popupAnchor: [0, -24], // Position popup above the icon
    });

    return (
        <Marker
            icon={customIcon}
            key={venue.id}
            position={[venue.lat, venue.lng]}
        >
            <Popup>
                <b>{venue.name}</b><br />
                <small>{venue.address}</small>
                {venue.shows.map((show) => (
                    <div key={show.id}>
                        {`${formatDate(show.date)}${show.start_time ? `, ${formatTime(show.start_time)}` : ""}`}:: {show.bands.map(band => band.name).join(", ")}
                    </div>
                ))}
            </Popup>
        </Marker>
    );
}

function formatDate(date: string) {
    return new Date(date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })
}
function formatTime(time: string) {
    const [hour, minute] = time.split(":");
    const hour12 = (parseInt(hour) % 12) || 12;
    const ampm = parseInt(hour) >= 12 ? "PM" : "AM";
    return `${hour12}:${minute} ${ampm}`;
}
