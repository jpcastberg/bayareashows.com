export interface Details {
    raw: string
}

export interface Show {
    id: number;
    date: string;
    location: string;
    bands: string[];
    lat: number;
    lng: number;
    details: Details;
}

export interface Venue {
    id: string;
    name: string;
    formatted_address: string;
    lat: number;
    lng: number;
    photo: string
    shows: Show[]
}
