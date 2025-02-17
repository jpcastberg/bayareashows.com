"use client";
import dynamic from "next/dynamic";

export default function Home() {
    const Map = dynamic(() => import("../components/Map"), { ssr: false })
    return (
        <div>
            <Map></Map>
        </div>
    );
}
