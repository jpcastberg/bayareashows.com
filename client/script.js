import L, {Map, TileLayer, Marker, LatLng, DivIcon} from '/lib/leaflet/leaflet.js';

const map = new Map('map').setView([37.778144, -122.417327], 13);

new TileLayer('/tiles/{z}/{x}/{y}.png', {
    maxZoom: 13,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

load();

async function load() {
    const { venues } = await fetch("/api/shows").then(response => response.json());
    venues.forEach(venue => {
        const customIcon = new DivIcon({
            className: "venue-marker",
            html: `
                <img class="venue-image" src="${venue.photo}" alt="${venue.name}" title="${venue.name}" onerror="this.onerror = null; this.src = '/images/concert.jpg'" />
            `,
            iconSize: [48, 48], // Adjust size as needed
            // iconAnchor: [16, 48], // Anchor point to center the icon
            popupAnchor: [0, -24], // Position popup above the icon
        });

        const marker = new Marker(new LatLng(venue.lat, venue.lng), {
            icon: customIcon,
        })

        const popup = `<b>${venue.name}</b>
                <br />
                <a target="_blank" href=${getMapLink(venue)}>
                    <small>${venue.address}</small>
                </a>
                ${venue.shows.map((show) => (
                    `<div>
                        ${`${formatDate(show.date)}${
                            show.start_time
                                ? `, ${formatTime(show.start_time)}`
                                : ""
                        }`}
                        :: ${show.bands.map((band) => band.name).join(", ")}
                    </div>`
                ))}`
        marker.bindPopup(popup);
        marker.addTo(map);
    });
}

function formatDate(date) {
    return new Date(date).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
    });
}
function formatTime(time) {
    const [hour, minute] = time.split(":");
    const hour12 = parseInt(hour) % 12 || 12;
    const ampm = parseInt(hour) >= 12 ? "PM" : "AM";
    return `${hour12}:${minute} ${ampm}`;
}

function getMapLink(venue) {
    if (
        navigator.platform.includes("iPhone") ||
        navigator.platform.includes("iPad") ||
        navigator.platform.includes("iPod")
    ) {
        return `maps://maps.google.com/maps?daddr=${venue.address}&amp;ll=`;
    }

    return `https://maps.google.com/maps?daddr=${venue.address}&amp;ll=`;
}
