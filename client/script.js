import {Map as LeafletMap, TileLayer, Marker, LatLng, DivIcon, LayerGroup} from '/lib/leaflet/leaflet.js';

const center = [37.778144, -122.417327];
const map = new LeafletMap('map').setView(center, 13);
const venueLayer = new LayerGroup().addTo(map);

const controls = document.getElementById("controls");
const dateForm = document.getElementById("date-filter");
const bandInput = document.getElementById("band-name");
const startDateInput = document.getElementById("start-date");
const endDateInput = document.getElementById("end-date");
const resetDatesButton = document.getElementById("reset-dates");
const bandPrevButton = document.getElementById("band-prev");
const bandNextButton = document.getElementById("band-next");
const listToggleButton = document.getElementById("list-toggle");
const listModal = document.getElementById("list-modal");
const listModalBody = document.getElementById("list-modal-body");
const listCount = document.getElementById("list-count");
const presetButtons = document.querySelectorAll("[data-preset]");
const modalCloseTargets = document.querySelectorAll("[data-modal-close]");

let lastVenues = [];
let bandShows = [];
let bandShowIndex = -1;
let venueMarkers = new Map();

new TileLayer('/tiles/{z}/{x}/{y}.png', {
    maxZoom: 13,
    attribution: '&copy; <a href="http://www.openstreetmap.org/copyright">OpenStreetMap</a>'
}).addTo(map);

const initialState = readQueryState();
const normalizedDates = normalizeDateRange({
    startDate: initialState.startDate,
    endDate: initialState.endDate,
});
updateDateInputs(normalizedDates);
updateBandInput(initialState.band);

if (initialState.band) {
    setQueryState({ band: initialState.band, startDate: "", endDate: "" });
    load({ band: initialState.band });
} else {
    setQueryState({
        band: "",
        startDate: normalizedDates.startDate,
        endDate: normalizedDates.endDate,
    });
    load({
        startDate: normalizedDates.startDate,
        endDate: normalizedDates.endDate,
    });
}

dateForm.addEventListener("submit", (event) => {
    event.preventDefault();
    if (bandInput.value.trim()) {
        applyBandFilter();
        return;
    }

    applyDateFilter();
});

startDateInput.addEventListener("change", () => {
    applyDateFilter();
});

endDateInput.addEventListener("change", () => {
    applyDateFilter();
});

resetDatesButton.addEventListener("click", () => {
    const resetRange = { startDate: today(), endDate: today() };
    updateDateInputs(resetRange);
    updateBandInput("");
    setQueryState({
        band: "",
        startDate: resetRange.startDate,
        endDate: resetRange.endDate,
    });
    load(resetRange);
    map.setView(center, 13);
});

presetButtons.forEach((button) => {
    button.addEventListener("click", () => {
        const preset = button.dataset.preset;
        const range = getPresetRange(preset);
        updateDateInputs(range);
        updateBandInput("");
        setQueryState({ band: "", startDate: range.startDate, endDate: range.endDate });
        load(range);
    });
});

async function load({ startDate = "", endDate = "", band = "" } = {}) {
    venueLayer.clearLayers();
    venueMarkers.clear();
    const url = buildApiUrl({ startDate, endDate, band });
    const { venues } = await fetch(url).then(response => response.json());
    lastVenues = venues;
    updateShowList(venues);
    setBandMode(Boolean(band));
    if (band) {
        updateBandNavigation(venues);
    } else {
        resetBandNavigation();
    }
    venues.forEach(venue => {
        const customIcon = new DivIcon({
            className: "venue-marker",
            html: `
                <img class="venue-image" src="${escapeHtml(venue.photo)}" alt="${escapeHtml(venue.name)}" title="${escapeHtml(venue.name)}" onerror="this.onerror = null; this.src = '/images/concert.jpg'" />
            `,
            iconSize: [48, 48], // Adjust size as needed
            // iconAnchor: [16, 48], // Anchor point to center the icon
            popupAnchor: [0, -24], // Position popup above the icon
        });

        const marker = new Marker(new LatLng(venue.lat, venue.lng), {
            icon: customIcon,
        })

        const popup = `
            <a target="_blank" rel="noopener" href="${escapeHtml(getMapLink(venue))}">
                <b>${venue.name}</b>
                <br />
                <small>${escapeHtml(venue.address)}</small>
            </a>
            <br>
            ${venue.shows.map((show) => (
            `<div>
                <a class="show-ics-link" href="${escapeHtml(getIcsLink(show.id))}" download>
                    ${formatDate(show.date)}${show.start_time
                        ? `, ${escapeHtml(formatTime(show.start_time))}`
                        : ""
                    }
                </a> :: ${show.bands.map((band) => escapeHtml(band.name)).join(", ")}
            </div>`
        )).join("\n")}`;
        marker.bindPopup(popup);
        venueLayer.addLayer(marker);
        venueMarkers.set(venue.id, marker);
    });
}

listToggleButton.addEventListener("click", () => {
    updateShowList(lastVenues);
    openListModal();
});

modalCloseTargets.forEach((target) => {
    target.addEventListener("click", () => {
        closeListModal();
    });
});

bandPrevButton.addEventListener("click", () => {
    if (bandShowIndex > 0) {
        bandShowIndex -= 1;
        updateBandNavButtons();
        zoomToShow(bandShows[bandShowIndex]);
    }
});

bandNextButton.addEventListener("click", () => {
    if (bandShowIndex < bandShows.length - 1) {
        bandShowIndex += 1;
        updateBandNavButtons();
        zoomToShow(bandShows[bandShowIndex]);
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && listModal.classList.contains("is-open")) {
        closeListModal();
    }
});

function applyDateFilter() {
    const range = normalizeDateRange(getDateFilterValues());
    updateDateInputs(range);
    updateBandInput("");
    setQueryState({ band: "", startDate: range.startDate, endDate: range.endDate });
    load(range);
}

function applyBandFilter() {
    const band = bandInput.value.trim();

    if (!band) {
        applyDateFilter();
        return;
    }

    updateBandInput(band);
    setQueryState({ band, startDate: "", endDate: "" });
    load({ band });
}

function getDateFilterValues() {
    return {
        startDate: startDateInput.value,
        endDate: endDateInput.value,
    };
}

function readQueryState() {
    const params = new URLSearchParams(window.location.search);
    return {
        band: params.get("band") || "",
        startDate: params.get("start_date") || "",
        endDate: params.get("end_date") || "",
    };
}

function setQueryState({ band = "", startDate = "", endDate = "" }) {
    const params = new URLSearchParams(window.location.search);

    if (band) {
        params.set("band", band);
    } else {
        params.delete("band");
    }

    if (startDate && !band) {
        params.set("start_date", startDate);
    } else {
        params.delete("start_date");
    }

    if (endDate && !band) {
        params.set("end_date", endDate);
    } else {
        params.delete("end_date");
    }

    const query = params.toString();
    const nextUrl = query ? `${window.location.pathname}?${query}` : window.location.pathname;
    window.history.replaceState({}, "", nextUrl);
}

function updateBandInput(value) {
    bandInput.value = value;
}

function updateDateInputs({ startDate, endDate }) {
    startDateInput.value = startDate;
    endDateInput.value = endDate;
    endDateInput.min = startDate || "";
}

function normalizeDateRange({ startDate, endDate }) {
    let normalizedStart = startDate || today();
    let normalizedEnd = endDate || normalizedStart;

    if (normalizedEnd < normalizedStart) {
        normalizedEnd = normalizedStart;
    }

    return { startDate: normalizedStart, endDate: normalizedEnd };
}

function getPresetRange(preset) {
    const todayValue = today();
    const todayDate = parseDateInput(todayValue);

    if (preset === "tomorrow") {
        const tomorrow = addDays(todayDate, 1);
        const dateValue = formatDateInput(tomorrow);
        return { startDate: dateValue, endDate: dateValue };
    }

    if (preset === "weekend") {
        const day = todayDate.getDay();
        let startDate = todayDate;
        let endDate = todayDate;

        if (day === 6) {
            endDate = addDays(todayDate, 1);
        } else if (day === 0) {
            endDate = todayDate;
        } else {
            const daysUntilSaturday = 6 - day;
            startDate = addDays(todayDate, daysUntilSaturday);
            endDate = addDays(startDate, 1);
        }

        return {
            startDate: formatDateInput(startDate),
            endDate: formatDateInput(endDate),
        };
    }

    return { startDate: todayValue, endDate: todayValue };
}

function buildApiUrl({ startDate, endDate, band }) {
    const params = new URLSearchParams();

    if (band) {
        params.set("band", band);
        const query = params.toString();
        return query ? `/api/shows?${query}` : "/api/shows";
    }

    if (startDate) {
        params.set("start_date", startDate);
    }

    if (endDate) {
        params.set("end_date", endDate);
    }

    const query = params.toString();
    return query ? `/api/shows?${query}` : "/api/shows";
}

function updateShowList(venues) {
    const shows = getSortedShows(venues);
    updateShowCounts(shows.length, venues.length);

    if (!shows.length) {
        listModalBody.innerHTML = '<div class="list-modal__empty">No shows match this view.</div>';
        return;
    }

    listModalBody.innerHTML = shows.map((show) => {
        const timeText = show.start_time ? `, ${escapeHtml(formatTime(show.start_time))}` : "";
        const bandsText = show.bands.length
            ? show.bands.filter(band => Boolean(band.name.trim())).map((band) => escapeHtml(band.name)).join(", ")
            : "";

        return `
            <div class="list-modal__item">
                <div class="list-modal__item-title">
                    <a target="_blank" rel="noopener noreferrer" href=${escapeHtml(show.venueMapLink)}>
                        ${escapeHtml(show.venueName)}
                    </a>
                </div>
                <div class="list-modal__item-meta">
                    <a class="show-ics-link" href="${escapeHtml(getIcsLink(show.id))}" download>
                        ${formatDate(show.date)}${timeText}
                    </a>
                    ${bandsText ? ` :: ${bandsText}` : ""}
                </div>
                <div class="list-modal__item-address">
                    <a target="_blank" rel="noopener" href=${escapeHtml(show.venueMapLink)}>
                        ${escapeHtml(show.venueAddress)}
                    </a>
                </div>
            </div>
        `;
    }).join("");
}

function flattenShows(venues) {
    return venues.flatMap((venue) =>
        venue.shows.map((show) => ({
            ...show,
            venueName: venue.name,
            venueAddress: venue.address,
            venueMapLink: getMapLink(venue),
            venueLat: venue.lat,
            venueLng: venue.lng,
            venueId: venue.id,
        }))
    );
}

function compareShows(a, b) {
    const dateCompare = a.date.localeCompare(b.date);
    if (dateCompare !== 0) {
        return dateCompare;
    }

    return (a.start_time || "").localeCompare(b.start_time || "");
}

function openListModal() {
    listModal.classList.add("is-open");
    listModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
}

function closeListModal() {
    listModal.classList.remove("is-open");
    listModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
}

function updateShowCounts(count, venuesCount) {
    const venueLabel = venuesCount === 1 ? "1 venue" : `${venuesCount} venues`;
    const showLabel = count === 1 ? "1 show" : `${count} shows`;
    const label = `${showLabel} in ${venueLabel}`;
    listCount.textContent = label;
    listToggleButton.textContent = label;
}

function getSortedShows(venues) {
    return flattenShows(venues).sort(compareShows);
}

function setBandMode(isBandMode) {
    controls.classList.toggle("is-band-mode", isBandMode);
}

function updateBandNavigation(venues) {
    bandShows = getSortedShows(venues);
    if (!bandShows.length) {
        bandShowIndex = -1;
        updateBandNavButtons();
        return;
    }

    bandShowIndex = 0;
    updateBandNavButtons();
    zoomToShow(bandShows[bandShowIndex]);
}

function resetBandNavigation() {
    bandShows = [];
    bandShowIndex = -1;
    updateBandNavButtons();
}

function updateBandNavButtons() {
    const hasShows = bandShows.length > 0;
    bandPrevButton.disabled = !hasShows || bandShowIndex <= 0;
    bandNextButton.disabled = !hasShows || bandShowIndex >= bandShows.length - 1;
}

function zoomToShow(show) {
    if (!show) {
        return;
    }

    const zoom = Math.max(map.getZoom(), 14);
    const marker = venueMarkers.get(show.venueId);
    if (marker) {
        map.once("moveend", () => {
            marker.openPopup();
        });
    }
    map.setView([show.venueLat, show.venueLng], zoom, { animate: true });
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
        return `maps://maps.google.com/maps?daddr=${encodeURIComponent(venue.address)}&amp;ll=`;
    }

    return `https://maps.google.com/maps?daddr=${encodeURIComponent(venue.address)}&amp;ll=`;
}

function getIcsLink(showId) {
    return `/api/shows/${encodeURIComponent(showId)}/ics`;
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    };
    return text.replace(/[&<>"']/g, char => map[char]);
}

function today() {
    return formatDateInput(new Date());
}

function formatDateInput(date) {
    return date.toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' });
}

function parseDateInput(value) {
    return new Date(`${value}T00:00:00`);
}

function addDays(date, days) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
}
