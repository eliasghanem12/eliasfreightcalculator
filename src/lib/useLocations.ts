// src/lib/useLocations.ts — locations from the API, with the bundled list as fallback.
import { useEffect, useState } from "react";
import { getLocations, type LocationsDoc } from "./api";
import { AIRPORTS, SEAPORTS, WAREHOUSES, COUNTRY_NAMES } from "./locations";

export const BUNDLED: LocationsDoc = {
  countries: Object.entries(COUNTRY_NAMES).map(([code, name]) => ({ code, name })),
  airports: AIRPORTS, seaports: SEAPORTS, warehouses: WAREHOUSES,
};

export function useLocations() {
  const [doc, setDoc] = useState<LocationsDoc>(BUNDLED);
  const [source, setSource] = useState<"loading" | "api" | "bundled">("loading");
  const [error, setError] = useState("");
  const reload = () => {
    setSource("loading");
    getLocations().then((d) => { setDoc(d); setSource("api"); setError(""); })
      .catch((e) => { setDoc(BUNDLED); setSource("bundled"); setError(e?.message || "Could not load locations"); });
  };
  useEffect(reload, []);
  return { doc, setDoc, source, error, reload };
}

export const countryName = (doc: LocationsDoc, code: string) => doc.countries.find((c) => c.code === code)?.name ?? code;
