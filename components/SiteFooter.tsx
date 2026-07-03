import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { COMPANY, FOOTER_LINKS } from '../constants/company';

export const SiteFooter = () => {
  const year = new Date().getFullYear();
  return (
    <View style={s.wrap} data-testid="site-footer">
      <Text style={s.brand}>{COMPANY.brand}</Text>
      <View style={s.links}>
        {FOOTER_LINKS.map((l) => (
          <TouchableOpacity
            key={l.route}
            onPress={() => router.push(l.route as any)}
            data-testid={`footer-link-${l.route.replace('/', '')}`}
          >
            <Text style={s.link}>{l.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <Text style={s.fine}>{COMPANY.operatedBy}</Text>
      <Text style={s.fine}>© {year} {COMPANY.legalName}. All rights reserved.</Text>
    </View>
  );
};

const s = StyleSheet.create({
  wrap: { backgroundColor: 'transparent', paddingVertical: 28, paddingHorizontal: 20, marginTop: 8, borderTopWidth: 1, borderTopColor: '#e5e7eb' },
  brand: { color: '#111827', fontSize: 20, fontWeight: '800', letterSpacing: 0.5, marginBottom: 14 },
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, rowGap: 12, marginBottom: 18 },
  link: { color: '#2563eb', fontSize: 13, fontWeight: '600', marginRight: 8 },
  fine: { color: '#9ca3af', fontSize: 11, lineHeight: 17, marginTop: 4 },
});

