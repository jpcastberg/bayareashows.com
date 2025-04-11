import { NextRequest, NextResponse } from 'next/server';
import db from '@/db';
import mysql2 from 'mysql2/promise';
import { DbBand, DbShow, DbVenue, Show, Venue } from '@/models';

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const today = new Date().toISOString().split('T')[0];
    const startDate = searchParams.get('start_date') || today;
    const endDate = searchParams.get('end_date') || today;

    if (!startDate || !endDate) {
        return NextResponse.json(
            { error: 'start_date and end_date query parameters are required' },
            { status: 400 }
        );
    }

    try {
        const [shows] = await db.execute<DbShow[]>("SELECT * FROM shows WHERE deleted = 0 AND date >= ? AND date <= ?", [startDate, endDate]);
        const processedShows = await processShows(shows);
        return NextResponse.json({venues: processedShows});
    } catch (error) {
        console.error('Error fetching shows:', error);
        return NextResponse.json(
            { error: 'Failed to fetch shows' },
            { status: 500 }
        );
    }
}

async function processShows(shows: Show[]): Promise<Venue[]> {
    const venueIds = new Set();
    for (const show of shows) {
        const [bands] = await db.execute<DbBand[]>("SELECT bands.* FROM bands_shows JOIN bands ON bands_shows.band_id = bands.id WHERE show_id = ?", [show.id]);
        show.bands = bands;
        venueIds.add(mysql2.escape(show.venue_id))
    }

    const [venues] = await db.execute<DbVenue[]>(`SELECT * FROM venues WHERE id IN (${[...venueIds].join(",")})`);
    const venueMap = new Map<number, DbVenue>()
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
