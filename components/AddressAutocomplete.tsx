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
};

const US_STATE_ABBR: Record<string, string> = {};

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

// Free Komoot Photon geocoder — no API key. Results filtered to the US.
export default function AddressAutocomplete({ value, onChangeText, onSelect, placeholder, inputStyle, testID }: Props) {
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timer = useRef<any>(null);
  const skipNext = useRef(false);

  useEffect(() => {
    if (skipNext.current) { skipNext.current = false; return; }
    if (timer.current) clearTimeout(timer.current);
    const q = value?.trim();
    if (!q || q.length < 3) { setSuggestions([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      setLoading(true);
      try {
        // Bias toward the US (center lat/lon) and request English labels
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=8&lang=en&lat=39.8283&lon=-98.5795`;
        const res = await fetch(url);
        const data = await res.json();
        const feats = (data.features || [])
          .filter((f: any) => (f.properties?.countrycode === 'US' || f.properties?.country === 'United States'));
        setSuggestions(feats.slice(0, 6));
        setOpen(feats.length > 0);
      } catch {
        setSuggestions([]);
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
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          data-testid={testID || 'address-autocomplete-input'}
        />
        {loading && <ActivityIndicator size="small" color="#9ca3af" />}
      </View>
      {open && (
        <View style={styles.dropdown}>
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
});
