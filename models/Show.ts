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
