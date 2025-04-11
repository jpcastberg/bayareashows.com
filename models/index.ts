import { RowDataPacket } from "mysql2";

export interface Band {
    id: number
    name: string
    created_date: string
    updated_date: string
}

export interface Show {
    id: number
    date: string
    venue_id: number
    start_time: string
    end_time: string
    cost: string
    age_limit: string
    sell_out_likely: boolean
    under_21_pays_more: boolean
    mosh_pit: boolean
    no_ins_outs: boolean
    sold_out: boolean
    raw: string
    photo: string
    deleted: boolean
    created_date: string
    updated_date: string
    bands: Band[]
}

export interface Venue {
    id: number
    google_place_id: string
    name: string
    address: string
    city: string
    lat: number
    lng: number
    age_limit: string
    photo: string
    created_date: string
    updated_date: string
    shows: Show[]
}

export interface DbBand extends Band, RowDataPacket {}
export interface DbShow extends Show, RowDataPacket {}
export interface DbVenue extends Venue, RowDataPacket {}
