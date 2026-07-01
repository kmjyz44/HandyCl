import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

type AddressParts = {
  line1?: string; city?: string; state?: string; postal_code?: string; country?: string;
  lat?: number; lon?: number;
};

type Props = {
  value: string;
  onChangeText: (v: string) => void;
  onSelect?: (formatted: string, parts: AddressParts) => void;
  placeholder?: string;
  inputStyle?: any;
  testID?: string;
  // When provided, street results are restricted to this city (and its US state)
  city?: string;
};

function buildFormatted(p: any): { formatted: string; parts: AddressParts } {
  const line1 = [p.housenumber, p.street || p.name].filter(Boolean).join(' ');
  const parts: AddressParts = {
    line1: line1 || p.name,
    city: p.city || p.county || p.district,
    state: p.state,
    postal_code: p.postcode,
    country: p.country,
  };
  const formatted = [parts.line1, parts.city, parts.state, parts.postal_code].filter(Boolean).join(', ');
  return { formatted, parts };
}

const norm = (s?: string) => (s || '').trim().toLowerCase();

// Free Komoot Photon geocoder — no API key. Results filtered to the US and,
// when a city is provided, restricted to that city's US state.
export default function AddressAutocomplete({ value, onChangeText, onSelect, placeholder, inputStyle, testID, city }: Props) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [noResults, setNoResults] = useState(false);
  const timer = useRef<any>(null);
  const skipNext = useRef(false);
  // Resolved context for the selected city: its center + US state.
  const cityCtx = useRef<{ name: string; state?: string; lat?: number; lon?: number } | null>(null);

  // Resolve the selected city -> its state + coordinates (used to bias + filter streets).
  useEffect(() => {
    const c = norm(city);
    if (!c || c.length < 2) { cityCtx.current = null; return; }
    if (cityCtx.current && norm(cityCtx.current.name) === c) return; // already resolved
    let cancelled = false;
    (async () => {
      try {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(city as string)}&limit=8&lang=en&lat=39.8283&lon=-98.5795&osm_tag=place`;
        const res = await fetch(url);
        const data = await res.json();
        const feats = (data.features || []).filter((f: any) =>
          (f.properties?.countrycode === 'US' || f.properties?.country === 'United States'));
        // Prefer an exact city-name match, else the first US place result
        const exact = feats.find((f: any) => norm(f.properties?.name) === c || norm(f.properties?.city) === c);
        const chosen = exact || feats[0];
        if (!cancelled && chosen) {
          const coords = chosen.geometry?.coordinates;
          cityCtx.current = {
            name: city as string,
            state: chosen.properties?.state,
            lat: coords ? coords[1] : undefined,
            lon: coords ? coords[0] : undefined,
          };
        } else if (!cancelled) {
          cityCtx.current = { name: city as string };
        }
      } catch {
        if (!cancelled) cityCtx.current = { name: city as string };
      }
    })();
    return () => { cancelled = true; };
  }, [city]);

  useEffect(() => {
    if (skipNext.current) { skipNext.current = false; return; }
    if (timer.current) clearTimeout(timer.current);
    const q = value?.trim();
    if (!q || q.length < 3) { setSuggestions([]); setOpen(false); setNoResults(false); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        const ctx = cityCtx.current;
        const biasLat = ctx?.lat ?? 39.8283;
        const biasLon = ctx?.lon ?? -98.5795;
        // Include the city (and state) in the query so Photon ranks that area first
        const queryText = ctx && norm(ctx.name)
          ? `${q}, ${ctx.name}${ctx.state ? ', ' + ctx.state : ''}`
          : q;
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(queryText)}&limit=10&lang=en&lat=${biasLat}&lon=${biasLon}`;
        const res = await fetch(url);
        const data = await res.json();
        let feats = (data.features || [])
          .filter((f: any) => (f.properties?.countrycode === 'US' || f.properties?.country === 'United States'));

        // Restrict to the selected city's state (strict) — prevents other-state results
        if (ctx?.state) {
          const st = norm(ctx.state);
          const inState = feats.filter((f: any) => norm(f.properties?.state) === st);
          feats = inState;
          // Within the state, put same-city matches first
          const cityName = norm(ctx.name);
          feats.sort((a: any, b: any) => {
            const am = (norm(a.properties?.city) === cityName || norm(a.properties?.county) === cityName) ? 0 : 1;
            const bm = (norm(b.properties?.city) === cityName || norm(b.properties?.county) === cityName) ? 0 : 1;
            return am - bm;
          });
        }

        const top = feats.slice(0, 6);
        setSuggestions(top);
        setOpen(true);
        setNoResults(top.length === 0);
      } catch {
        setSuggestions([]);
        setNoResults(false);
      } finally {
        setLoading(false);
      }
    }, 350);
    return () => timer.current && clearTimeout(timer.current);
  }, [value]);

  const pick = (f: any) => {
    const { formatted, parts } = buildFormatted(f.properties || {});
    const coords = f.geometry?.coordinates;
    if (coords) { parts.lat = coords[1]; parts.lon = coords[0]; }
    skipNext.current = true;
    onChangeText(formatted);
    onSelect?.(formatted, parts);
    setOpen(false);
    setSuggestions([]);
    setNoResults(false);
  };

  return (
    <View style={{ position: 'relative', zIndex: 50 }}>
      <View style={styles.inputWrap}>
        <Ionicons name="location-outline" size={18} color="#9ca3af" style={{ marginRight: 8 }} />
        <TextInput
          style={[styles.input, inputStyle]}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder || 'Start typing an address…'}
          autoCapitalize="words"
          onFocus={() => (suggestions.length > 0 || noResults) && setOpen(true)}
          data-testid={testID || 'address-autocomplete-input'}
        />
        {loading && <ActivityIndicator size="small" color="#9ca3af" />}
      </View>
      {open && (suggestions.length > 0 || noResults) && (
        <View style={styles.dropdown}>
          {noResults ? (
            <View style={styles.emptyItem}>
              <Ionicons name="alert-circle-outline" size={16} color="#9ca3af" style={{ marginRight: 8 }} />
              <Text style={styles.emptyText}>
                {city ? `No streets found in ${city}. Check the city or spelling.` : 'No matching addresses found.'}
              </Text>
            </View>
          ) : (
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 220 }}>
              {suggestions.map((f, i) => {
                const { formatted } = buildFormatted(f.properties || {});
                return (
                  <TouchableOpacity
                    key={`${f.properties?.osm_id || i}`}
                    style={styles.item}
                    onPress={() => pick(f)}
                    data-testid={`address-suggestion-${i}`}
                  >
                    <Ionicons name="location" size={16} color="#2563eb" style={{ marginRight: 8 }} />
                    <Text style={styles.itemText} numberOfLines={2}>{formatted}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  inputWrap: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingHorizontal: 12, backgroundColor: '#f9fafb' },
  input: { flex: 1, paddingVertical: 12, fontSize: 16, color: '#111827' },
  dropdown: { position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 4, backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6, zIndex: 100 },
  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  itemText: { flex: 1, fontSize: 14, color: '#374151' },
  emptyItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 12 },
  emptyText: { flex: 1, fontSize: 13, color: '#6b7280' },
});
