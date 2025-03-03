import { Marker, Popup } from "react-leaflet";
import { Icon } from "leaflet";
import { Venue } from "@/models/Venue";

export default function VenueMarker({ venue }: { venue: Venue }) {
    return (<Marker
        icon={
            new Icon({
                iconUrl: venue.photo,
            })
        }
        key={venue.formatted_address}
        position={[venue.lat, venue.lng]}>
        <Popup>
            {venue.shows.map((show) => (
                <div key={show.id}>
                    {show.date} :: {show.bands.join(", ")} :: {show.details.raw}
                </div>
            ))}
        </Popup>
    </Marker>);
}
