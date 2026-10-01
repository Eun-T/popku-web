"use client";

import { useEffect, useRef, useState } from "react";

export type SelectedPlace = { address: string; latitude: number; longitude: number };

type Prediction = {
  text: { toString(): string };
  toPlace(): {
    fetchFields(request: { fields: string[] }): Promise<void>;
    displayName?: string;
    formattedAddress?: string;
    location?: { lat(): number; lng(): number };
  };
};
type PlacesLibrary = {
  AutocompleteSessionToken: new () => object;
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions(request: {
      input: string; includedRegionCodes: string[]; region: string; sessionToken: object;
    }): Promise<{ suggestions: { placePrediction?: Prediction }[] }>;
  };
};
type MapsWindow = Window & {
  google?: { maps?: { importLibrary(name: string): Promise<unknown> } };
  __popkuPlacesReady?: () => void;
};

let placesPromise: Promise<PlacesLibrary> | null = null;

function loadPlaces(key: string): Promise<PlacesLibrary> {
  if (placesPromise) return placesPromise;
  placesPromise = new Promise<PlacesLibrary>((resolve, reject) => {
    const mapsWindow = window as MapsWindow;
    const importPlaces = () => mapsWindow.google?.maps?.importLibrary("places")
      .then((library) => resolve(library as PlacesLibrary))
      .catch(reject);
    if (mapsWindow.google?.maps?.importLibrary) { importPlaces(); return; }

    const script = document.createElement("script");
    let settled = false;
    const timeout = window.setTimeout(() => fail(), 15000);
    function clean() {
      window.clearTimeout(timeout);
      delete mapsWindow.__popkuPlacesReady;
      script.onerror = null;
    }
    function fail() {
      if (settled) return;
      settled = true;
      clean();
      script.remove();
      reject(new Error("Google Places could not load"));
    }
    mapsWindow.__popkuPlacesReady = () => {
      if (settled) return;
      settled = true;
      clean();
      importPlaces();
    };
    script.async = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&libraries=places&callback=__popkuPlacesReady`;
    script.onerror = fail;
    document.head.appendChild(script);
  }).catch((error) => {
    placesPromise = null;
    throw error;
  });
  return placesPromise;
}

export default function PlaceSearch({ countryCode, onSelect }: {
  countryCode: "KR" | "JP";
  onSelect: (place: SelectedPlace | null) => void;
}) {
  const [library, setLibrary] = useState<PlacesLibrary | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Prediction[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [selectedAddress, setSelectedAddress] = useState("");
  const requestNumber = useRef(0);
  const token = useRef<object | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) { setLoadError(true); return; }
    void loadPlaces(key).then((loaded) => {
      if (mounted.current) setLibrary(loaded);
    }).catch(() => {
      if (mounted.current) setLoadError(true);
    });
    return () => { mounted.current = false; requestNumber.current += 1; };
  }, []);

  useEffect(() => {
    const current = ++requestNumber.current;
    if (!library || selectedAddress || query.trim().length < 2) {
      setSuggestions([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    setSearchError("");
    const timer = window.setTimeout(async () => {
      try {
        if (!token.current) token.current = new library.AutocompleteSessionToken();
        const result = await library.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query.trim(), includedRegionCodes: [countryCode.toLowerCase()],
          region: countryCode.toLowerCase(), sessionToken: token.current,
        });
        if (mounted.current && requestNumber.current === current) {
          setSuggestions(result.suggestions.flatMap((item) => item.placePrediction ? [item.placePrediction] : []));
        }
      } catch {
        if (mounted.current && requestNumber.current === current) {
          setSuggestions([]);
          setSearchError("장소 검색을 사용할 수 없습니다. 잠시 후 다시 시도해 주세요.");
        }
      } finally {
        if (mounted.current && requestNumber.current === current) setSearching(false);
      }
    }, 250);
    return () => window.clearTimeout(timer);
  }, [countryCode, library, query, selectedAddress]);

  function editQuery(value: string) {
    requestNumber.current += 1;
    setQuery(value);
    setSelectedAddress("");
    setSuggestions([]);
    setSearchError("");
    onSelect(null);
  }

  async function choose(prediction: Prediction) {
    const current = ++requestNumber.current;
    setSuggestions([]);
    setSearching(true);
    setSearchError("");
    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ["displayName", "formattedAddress", "location"] });
      if (!mounted.current || requestNumber.current !== current) return;
      const address = place.formattedAddress?.trim();
      const latitude = place.location?.lat();
      const longitude = place.location?.lng();
      if (!address || address.length > 255 || latitude === undefined || longitude === undefined ||
          !Number.isFinite(latitude) || !Number.isFinite(longitude) ||
          latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        throw new Error("Incomplete place details");
      }
      setQuery(place.displayName || prediction.text.toString());
      setSelectedAddress(address);
      onSelect({ address, latitude, longitude });
      token.current = null;
    } catch {
      if (mounted.current && requestNumber.current === current) {
        setSearchError("장소 정보를 확인하지 못했습니다. 다른 검색 결과를 선택해 주세요.");
        onSelect(null);
      }
    } finally {
      if (mounted.current && requestNumber.current === current) setSearching(false);
    }
  }

  return <div>
    <label htmlFor="popup-place-search" className="block text-sm font-medium text-slate-800">장소/주소 <span className="text-red-700">*</span></label>
    <div className="relative mt-1">
      <input id="popup-place-search" type="text" value={query} onChange={(event) => editQuery(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && suggestions.length) {
            event.preventDefault();
            void choose(suggestions[0]);
          }
          if (event.key === "Escape") setSuggestions([]);
        }}
        placeholder={countryCode === "KR" ? "장소명 또는 주소 검색 (예: 더현대 서울)" : "장소명 또는 주소 검색 (예: 渋谷 PARCO)"}
        disabled={!library || loadError}
        role="combobox" aria-autocomplete="list" aria-expanded={suggestions.length > 0}
        aria-controls="popup-place-options"
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:bg-slate-50" />
      {suggestions.length > 0 && <div id="popup-place-options" role="listbox"
        className="absolute z-20 mt-1 max-h-64 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
        {suggestions.map((prediction, index) => <button key={`${prediction.text.toString()}-${index}`} type="button" role="option" aria-selected={false}
          onClick={() => void choose(prediction)} className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50 focus:bg-blue-50">
          {prediction.text.toString()}
        </button>)}
        <p className="border-t border-slate-100 px-3 py-1 text-right text-xs text-slate-500">Google Maps</p>
      </div>}
    </div>
    {!library && !loadError && <p role="status" className="mt-1 text-xs text-slate-600">Google 장소 검색을 불러오는 중입니다.</p>}
    {loadError && <p role="alert" className="mt-1 text-xs text-red-700">장소 검색을 사용할 수 없습니다. 관리자에게 설정을 확인해 주세요.</p>}
    {searching && <p role="status" className="mt-1 text-xs text-slate-600">장소를 검색하는 중입니다.</p>}
    {searchError && <p role="alert" className="mt-1 text-xs text-red-700">{searchError}</p>}
    {selectedAddress && <p className="mt-2 text-sm text-slate-700"><span className="font-medium">선택된 주소</span><br />{selectedAddress} <span className="text-xs text-slate-500">Google Maps</span></p>}
    {!selectedAddress && !loadError && <p className="mt-1 text-xs text-slate-500">검색 결과에서 장소 또는 주소를 선택해 주세요.</p>}
  </div>;
}
