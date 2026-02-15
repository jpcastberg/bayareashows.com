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

    if (!startDate || !endDate) {
        return res.json(
            { error: "start_date and end_date query parameters are required" },
            { status: 400 }
        );
    }

    try {
        const [shows] = await db.execute("SELECT * FROM shows WHERE deleted = 0 AND date >= ? AND date <= ?", [startDate, endDate]);
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

app.get("/tiles/:z/:x/:y.png", (req, res) => {
    const { z, x, y } = req.params;
    const url = `https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/${z}/${x}/${y}.png?api_key=${process.env.STADIA_API_KEY}`;
    console.log(url);
    fetch(url)
        .then(response => response.arrayBuffer())
        .then(buffer => {
            res.set("Content-Type", "image/png");
            res.send(Buffer.from(buffer));
        })
        .catch(err => res.status(500).send("Error fetching tile"));
});

app.listen(port, () => {
    console.log(`Example app listening on port ${port}`);
    console.log(`ENV: ${JSON.stringify(process.env)}`);

});

async function processShows(shows) {
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

