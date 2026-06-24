import { LatLng } from '../types';

// ─── Operational Zone: Dantewada Kirandul, Chhattisgarh, India ───────────────
/**
 * Geographic centre of the KDLGOODS operational zone.
 * Kirandul, Dantewada District, Chhattisgarh — 18.8728°N, 81.7074°E
 */
export const DANTEWADA_CENTER: LatLng = {
  latitude: 18.8728,
  longitude: 81.7074,
};

/** Human-readable town name used across UI strings. */
export const TOWN_NAME = 'Kirandul, Dantewada, Chhattisgarh';

/** Strict 5 km radius SLA geofence for 30-minute delivery guarantee. */
export const OPERATIONAL_GEOFENCE_KM = 5;

/**
 * Returns true when the given coordinate falls within the 5 km
 * operational delivery zone centred on Dantewada Kirandul.
 */
export function isWithinOperationalZone(coord: LatLng): boolean {
  return isWithinSlaRadius(DANTEWADA_CENTER, coord, OPERATIONAL_GEOFENCE_KM);
}
// ─────────────────────────────────────────────────────────────────────────────

const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
const BITS = [16, 8, 4, 2, 1];

/**
 * Calculates the geodetic distance between two coordinates using the Haversine formula.
 * @returns Distance in kilometers.
 */
export function calculateDistance(coord1: LatLng, coord2: LatLng): number {
  const R = 6371; // Earth's radius in kilometers
  const dLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const dLng = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((coord1.latitude * Math.PI) / 180) *
      Math.cos((coord2.latitude * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Validates whether two coordinates fall within the SLA radius.
 * @param radiusKm Default is 5km
 */
export function isWithinSlaRadius(coord1: LatLng, coord2: LatLng, radiusKm = 5): boolean {
  return calculateDistance(coord1, coord2) <= radiusKm;
}

/**
 * Encodes a latitude and longitude coordinate into a Geohash string.
 * @param latitude Coordinates in degrees decimal format
 * @param longitude Coordinates in degrees decimal format
 * @param precision Character count of geohash (defaults to 9 for ~4.82m precision)
 */
export function encodeGeohash(latitude: number, longitude: number, precision = 9): string {
  let isEven = true;
  let latMin = -90.0;
  let latMax = 90.0;
  let lngMin = -180.0;
  let lngMax = 180.0;

  let geohash = '';
  let bit = 0;
  let ch = 0;

  while (geohash.length < precision) {
    let mid = 0;
    if (isEven) {
      mid = (lngMin + lngMax) / 2.0;
      if (longitude > mid) {
        ch |= BITS[bit];
        lngMin = mid;
      } else {
        lngMax = mid;
      }
    } else {
      mid = (latMin + latMax) / 2.0;
      if (latitude > mid) {
        ch |= BITS[bit];
        latMin = mid;
      } else {
        latMax = mid;
      }
    }

    isEven = !isEven;
    if (bit < 4) {
      bit++;
    } else {
      geohash += BASE32.charAt(ch);
      bit = 0;
      ch = 0;
    }
  }

  return geohash;
}

export interface GeohashBounds {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

/**
 * Decodes a Geohash string into its bounding box boundaries.
 */
export function decodeGeohashBounds(geohash: string): GeohashBounds {
  let isEven = true;
  let latMin = -90.0;
  let latMax = 90.0;
  let lngMin = -180.0;
  let lngMax = 180.0;

  for (let i = 0; i < geohash.length; i++) {
    const c = geohash.charAt(i);
    const cd = BASE32.indexOf(c);
    if (cd === -1) throw new Error('Invalid Geohash character');

    for (let j = 0; j < 5; j++) {
      const mask = BITS[j];
      if (isEven) {
        const mid = (lngMin + lngMax) / 2;
        if ((cd & mask) !== 0) {
          lngMin = mid;
        } else {
          lngMax = mid;
        }
      } else {
        const mid = (latMin + latMax) / 2;
        if ((cd & mask) !== 0) {
          latMin = mid;
        } else {
          latMax = mid;
        }
      }
      isEven = !isEven;
    }
  }

  return {
    minLat: latMin,
    maxLat: latMax,
    minLng: lngMin,
    maxLng: lngMax,
  };
}

/**
 * Decodes a Geohash into center latitude and longitude coordinates.
 */
export function decodeGeohash(geohash: string): LatLng {
  const bounds = decodeGeohashBounds(geohash);
  return {
    latitude: (bounds.minLat + bounds.maxLat) / 2,
    longitude: (bounds.minLng + bounds.maxLng) / 2,
  };
}
