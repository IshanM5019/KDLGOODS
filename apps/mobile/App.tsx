import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, SafeAreaView, StatusBar } from 'react-native';
import { DANTEWADA_CENTER, TOWN_NAME, OPERATIONAL_GEOFENCE_KM, formatINR } from '@kdlgoods/shared';
import DeliveryPartnerView from './src/views/DeliveryPartnerView';

// ─── Blinkit Brand Colors ─────────────────────────────────────────────────────
const YELLOW  = '#F7D108';
const BLACK   = '#121212';
const DARK    = '#1A1A1A';
const CHARCOAL= '#222222';
const BORDER  = '#2E2E2E';
const GREY    = '#8A8A8A';
const GREY_LT = '#B0B0B0';
const GREEN   = '#22C55E';

export default function App() {
  // Toggle between Customer app and Delivery Partner views
  const [currentAppRole, setCurrentAppRole] = useState<'customer' | 'delivery'>('customer');

  // Default to Dantewada Kirandul operational centre — no Delhi coordinates
  const [latInput, setLatInput] = useState(String(DANTEWADA_CENTER.latitude));
  const [lngInput, setLngInput] = useState(String(DANTEWADA_CENTER.longitude));

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BLACK} />

      {/* Role Toggle Selector */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, currentAppRole === 'customer' && styles.activeTab]}
          onPress={() => setCurrentAppRole('customer')}
        >
          <Text style={[styles.tabText, currentAppRole === 'customer' && styles.activeTabText]}>🛒 Customer Portal</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, currentAppRole === 'delivery' && styles.activeTab]}
          onPress={() => setCurrentAppRole('delivery')}
        >
          <Text style={[styles.tabText, currentAppRole === 'delivery' && styles.activeTabText]}>🛵 Delivery Rider</Text>
        </TouchableOpacity>
      </View>

      {currentAppRole === 'delivery' ? (
        <DeliveryPartnerView />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>KDLGOODS ⚡</Text>
            <Text style={styles.subtitle}>30-Minute Hyper-Local Delivery</Text>
            <View style={styles.locationPill}>
              <Text style={styles.locationPillText}>📍 {TOWN_NAME}</Text>
            </View>
          </View>

          {/* Geo Info Card */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📍 Delivery Zone</Text>
            <Text style={styles.bodyText}>
              KDLGOODS strictly delivers within a <Text style={{ color: YELLOW, fontWeight: '700' }}>{OPERATIONAL_GEOFENCE_KM} km radius</Text> of {TOWN_NAME}.
            </Text>
            <Text style={[styles.bodyText, { marginTop: 8 }]}>
              Operational Centre: <Text style={{ color: GREY_LT, fontFamily: 'monospace' }}>
                {DANTEWADA_CENTER.latitude}°N, {DANTEWADA_CENTER.longitude}°E
              </Text>
            </Text>
          </View>

          {/* Coming Soon Stores Card */}
          <Text style={styles.sectionTitle}>Stores &amp; Restaurants Near You</Text>
          <View style={[styles.card, styles.emptyCard]}>
            <Text style={styles.emptyEmoji}>🏪</Text>
            <Text style={styles.emptyTitle}>No Stores Online Yet</Text>
            <Text style={styles.emptyBody}>
              KDLGOODS is launching soon in {TOWN_NAME}!{'\n'}
              Local sellers are being onboarded — check back shortly.
            </Text>
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BLACK,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: DARK,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    padding: 6,
    gap: 6,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: YELLOW,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: GREY,
  },
  activeTabText: {
    color: BLACK,
    fontWeight: '800',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
    marginTop: 10,
  },
  logo: {
    fontSize: 30,
    fontWeight: '900',
    color: YELLOW,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: GREY,
    marginTop: 4,
  },
  locationPill: {
    marginTop: 10,
    backgroundColor: 'rgba(247,209,8,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(247,209,8,0.3)',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  locationPillText: {
    color: YELLOW,
    fontSize: 11,
    fontWeight: '700',
  },
  card: {
    backgroundColor: DARK,
    borderRadius: 14,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: BORDER,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 40,
    borderStyle: 'dashed',
  },
  emptyEmoji: {
    fontSize: 40,
    marginBottom: 12,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: GREY,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: 13,
    color: '#444',
    textAlign: 'center',
    lineHeight: 20,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F5F5F5',
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F5F5F5',
    marginBottom: 12,
  },
  bodyText: {
    fontSize: 13,
    color: GREY_LT,
    lineHeight: 20,
  },
});
