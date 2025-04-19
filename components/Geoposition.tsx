import { useEffect } from "react";
import { useMap } from "react-leaflet";

export default function Geoposition() {
    const map = useMap();
    useEffect(() => {
        map.locate({setView: true, maxZoom: 12});
    });

    return (<span></span>);
}
