import express from "express";
import "dotenv/config";
import db from "./db.js";
import mysql from "mysql2/promise";
const app = express();
const port = 3000;

app.use(express.static("client"));
app.use("/lib/leaflet", express.static("node_modules/leaflet/dist"));
app.get("/api/shows", async (req, res) => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/Los_Angeles" });
    const startDate = req.query["start_date"] || today;
    const endDate = req.query["end_date"] || today;
    const band = typeof req.query["band"] === "string" ? req.query["band"].trim() : "";

    if (!band && (!startDate || !endDate)) {
        return res.json(
            { error: "start_date and end_date query parameters are required" },
            { status: 400 }
        );
    }

    try {
        let shows = [];

        if (band) {
            const [bandShows] = await db.execute(
                `SELECT DISTINCT shows.*
                FROM shows
                JOIN bands_shows ON bands_shows.show_id = shows.id
                JOIN bands ON bands.id = bands_shows.band_id
                WHERE shows.deleted = 0 AND shows.date >= ? AND bands.name LIKE ?`,
                [today, `%${band}%`]
            );
            shows = bandShows;
        } else {
            const [dateShows] = await db.execute(
                "SELECT * FROM shows WHERE deleted = 0 AND date >= ? AND date <= ?",
                [startDate, endDate]
            );
            shows = dateShows;
        }

        const processedShows = await processShows(shows);
        return res.json({ venues: processedShows });
    } catch (error) {
        console.error("Error fetching shows:", error);
        return res.json(
            { error: "Failed to fetch shows" },
            { status: 500 }
        );
    }
});

app.get("/api/shows/:id/event.ics", async (req, res) => {
    return handleShowIcs(req, res);
});

async function handleShowIcs(req, res) {
    const showId = Number.parseInt(req.params.id, 10);

    if (!Number.isInteger(showId)) {
        return res.status(400).send("Invalid show id");
    }

    try {
        const [shows] = await db.execute(
            "SELECT * FROM shows WHERE id = ? AND deleted = 0",
            [showId]
        );

        if (!shows.length) {
            return res.status(404).send("Show not found");
        }

        const show = shows[0];
        const [venues] = await db.execute(
            "SELECT * FROM venues WHERE id = ?",
            [show.venue_id]
        );
        const venue = venues[0] || null;
        const [bands] = await db.execute(
            "SELECT bands.* FROM bands_shows JOIN bands ON bands_shows.band_id = bands.id WHERE show_id = ?",
            [show.id]
        );

        const ics = buildShowIcs({ show, venue, bands });

        res.set("Content-Type", "text/calendar; charset=utf-8");
        res.set("Content-Disposition", `attachment; filename="show-${show.id}.ics"`);
        return res.send(ics);
    } catch (error) {
        console.error("Error generating ics:", error);
        return res.status(500).send("Failed to generate ics");
    }
}

app.get("/tiles/:z/:x/:y.png", (req, res) => {
    const { z, x, y } = req.params;
    const url = `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/${z}/${x}/${y}.png?api_key=${process.env.STADIA_API_KEY}`;
    fetch(url)
        .then(response => response.arrayBuffer())
        .then(buffer => {
            res.set("Content-Type", "image/png");
            res.send(Buffer.from(buffer));
        })
        .catch(err => res.status(500).send("Error fetching tile"));
});

app.listen(port, () => {
    console.log(`Bay Area Shows listening on port ${port}`);
});

async function processShows(shows) {
    if (!shows.length) {
        return [];
    }

    const venueIds = new Set();
    for (const show of shows) {
        const [bands] = await db.execute("SELECT bands.* FROM bands_shows JOIN bands ON bands_shows.band_id = bands.id WHERE show_id = ?", [show.id]);
        show.bands = bands;
        venueIds.add(mysql.escape(show.venue_id))
    }

    const [venues] = await db.execute(`SELECT * FROM venues WHERE id IN (${[...venueIds].join(",")})`);
    const venueMap = new Map()
    venues.forEach(venue => {
        venue.shows = [];
        venueMap.set(venue.id, venue)
    });
    shows.forEach(show => {
        const venue = venueMap.get(show.venue_id);
        if (venue) {
            venue.shows.push(show);
        }
    });

    return [...venueMap.values()];
}

function buildShowIcs({ show, venue, bands }) {
    const date = String(show.date);
    const time = show.start_time ? String(show.start_time) : "";
    const summary = buildShowSummary(show, venue, bands);
    const location = venue?.address ? escapeIcsText(venue.address) : "";
    const description = venue?.name ? escapeIcsText(venue.name) : "";
    const lat = venue?.lat ?? null;
    const lng = venue?.lng ?? null;
    const appleTitle = venue?.name ? escapeIcsText(venue.name) : "Venue";

    const lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Bay Area Shows//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "BEGIN:VEVENT",
        `UID:show-${show.id}@bayareashows.com`,
        `DTSTAMP:${formatIcsTimestamp(new Date())}`,
    ];

    if (time) {
        lines.push(`DTSTART;TZID=America/Los_Angeles:${formatIcsDateTime(date, time)}`);
        lines.push("DURATION:PT2H");
    } else {
        lines.push(`DTSTART;VALUE=DATE:${formatIcsDate(date)}`);
        lines.push(`DTEND;VALUE=DATE:${formatIcsDate(addDaysToDate(date, 1))}`);
    }

    lines.push(`SUMMARY:${escapeIcsText(summary)}`);
    if (location) {
        lines.push(`LOCATION:${location}`);
    }
    if (lat !== null && lng !== null) {
        lines.push(
            `X-APPLE-STRUCTURED-LOCATION;VALUE=URI;X-APPLE-RADIUS=70;X-APPLE-REFERENCEFRAME=0;X-TITLE=${appleTitle}:geo:${lat},${lng}`
        );
        lines.push(`GEO:${lat};${lng}`);
    }
    if (description) {
        lines.push(`DESCRIPTION:${description}`);
    }
    lines.push("END:VEVENT", "END:VCALENDAR");

    return lines.join("\r\n");
}

function buildShowSummary(show, venue, bands) {
    const bandNames = bands.map((band) => band.name).filter(Boolean).join(", ");
    const venueName = venue?.name || "Venue";

    if (bandNames) {
        return `${bandNames} @ ${venueName}`;
    }

    return `Show @ ${venueName}`;
}

function escapeIcsText(value) {
    return String(value)
        .replace(/\\/g, "\\\\")
        .replace(/\n/g, "\\n")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,");
}

function formatIcsDate(date) {
    return date.replace(/-/g, "");
}

function formatIcsDateTime(date, time) {
    const safeTime = time.length === 5 ? `${time}:00` : time;
    return `${formatIcsDate(date)}T${safeTime.replace(/:/g, "")}`;
}

function formatIcsTimestamp(date) {
    return date.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function addDaysToDate(dateString, days) {
    const base = new Date(`${dateString}T00:00:00Z`);
    base.setUTCDate(base.getUTCDate() + days);
    return base.toISOString().slice(0, 10);
}

