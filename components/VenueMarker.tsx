import { Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { Venue } from "@/models";
import styles from "./VenueMarker.module.css";

export default function VenueMarker({ venue }: { venue: Venue }) {
    const customIcon = L.divIcon({
        className: styles["custom-icon"],
        html: `
            <div class="${styles["icon-wrapper"]}">
                <img src="${venue.photo}" alt="Venue" class="${styles["icon-image"]}" />
                <div class="${styles.pin}"></div>
            </div>
        `,
        iconSize: [64, 64], // Adjust size as needed
        // iconAnchor: [16, 48], // Anchor point to center the icon
        popupAnchor: [0, -48], // Position popup above the icon
    });

    return (
        <Marker
            icon={customIcon}
            key={venue.id}
            position={[venue.lat, venue.lng]}
        >
            <Popup>
                {venue.shows.map((show) => (
                    <div key={show.id}>
                        {show.date} :: {show.bands.map(band => band.name).join(", ")} :: {show.raw}
                    </div>
                ))}
            </Popup>
        </Marker>
    );
}
