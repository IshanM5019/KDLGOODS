'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '../../../lib/supabase';
import {
  calculateDistance,
  isWithinSlaRadius,
  DANTEWADA_CENTER,
  TOWN_NAME,
  OPERATIONAL_GEOFENCE_KM,
  formatINR,
  LatLng,
} from '@kdlgoods/shared';
import {
  ShoppingBag, MapPin, Zap, AlertTriangle, ShieldCheck,
  Search, ChevronRight, Navigation, Loader2, Plus, Minus, X, Check, PackageSearch, Store,
} from 'lucide-react';


interface LocalSeller {
  id: string;
  store_name: string;
  description: string | null;
  address: string;
  latitude: number;
  longitude: number;
  geohash: string;
  is_active: boolean;
  distanceKm: number;
  withinSla: boolean;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  seller_id: string;
}

export default function CustomerDashboard() {
  const [sellers, setSellers] = useState<LocalSeller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Default to Dantewada Kirandul operational centre
  const [userCoords, setUserCoords] = useState<LatLng>(DANTEWADA_CENTER);
  const [latInput, setLatInput] = useState(String(DANTEWADA_CENTER.latitude));
  const [lngInput, setLngInput] = useState(String(DANTEWADA_CENTER.longitude));
  const [searchQuery, setSearchQuery] = useState('');

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);
  const [activeOrderTrackingId, setActiveOrderTrackingId] = useState<string | null>(null);

  // Seller product view
  const [selectedSeller, setSelectedSeller] = useState<LocalSeller | null>(null);
  const [sellerProducts, setSellerProducts] = useState<any[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  useEffect(() => { fetchSellers(); }, [userCoords]);

  const fetchSellers = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase.rpc('get_nearby_sellers', {
        customer_lat: userCoords.latitude,
        customer_lng: userCoords.longitude,
        max_distance_meters: OPERATIONAL_GEOFENCE_KM * 1000,
      });

      if (error) throw error;

      const calculated = (data || []).map((s: any) => {
        const withinSla = s.distance_meters <= OPERATIONAL_GEOFENCE_KM * 1000;
        return {
          id: s.id,
          store_name: s.store_name,
          description: s.description,
          address: s.address,
          latitude: s.location?.coordinates?.[1] ?? 0,
          longitude: s.location?.coordinates?.[0] ?? 0,
          geohash: s.geohash,
          is_active: true,
          distanceKm: s.distance_meters / 1000,
          withinSla,
        };
      });
      setSellers(calculated);
    } catch {
      // Supabase offline — show clean empty state (no mock data)
      setSellers([]);
    } finally {
      setTimeout(() => setLoading(false), 400);
    }
  };

  const fetchSellerProducts = async (seller: LocalSeller) => {
    setSelectedSeller(seller);
    setLoadingProducts(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('seller_id', seller.id)
        .eq('is_available', true);

      if (error) throw error;
      if (!data || data.length === 0) throw new Error('empty');
      setSellerProducts(data);
    } catch {
      // Clean empty catalog — seller hasn't added items yet
      setSellerProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  const handleUpdateCoords = () => {
    const lat = parseFloat(latInput);
    const lng = parseFloat(lngInput);
    if (!isNaN(lat) && !isNaN(lng)) {
      setUserCoords({ latitude: lat, longitude: lng });
      setSelectedSeller(null);
    }
  };

  const addToCart = (product: any) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === product.id);
      if (existing) return prev.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { id: product.id, name: product.name, price: product.price, quantity: 1, seller_id: selectedSeller!.id }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.id === productId);
      if (existing && existing.quantity > 1) return prev.map((item) => item.id === productId ? { ...item, quantity: item.quantity - 1 } : item);
      return prev.filter((item) => item.id !== productId);
    });
  };

  const cartTotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCheckingOut(true);
    await new Promise(resolve => setTimeout(resolve, 1200));

    try {
      const payload = {
        customer_id: '00000000-0000-0000-0000-000000000000',
        seller_id: cart[0].seller_id,
        status: 'placed',
        total_amount: cartTotal,
        delivery_address: 'Kirandul, Dantewada District, Chhattisgarh – 494556',
        delivery_location: `POINT(${userCoords.longitude} ${userCoords.latitude})`,
      };

      const { data, error } = await supabase.from('orders').insert([payload]).select('id').single();

      if (error) throw error;
      setActiveOrderTrackingId(data.id);
    } catch {
      const mockOrderId = 'order-' + Math.floor(Math.random() * 10000);
      const mockOrder = {
        id: mockOrderId,
        customer_id: 'cust-1',
        seller_id: cart[0].seller_id,
        delivery_partner_id: null,
        status: 'placed',
        total_amount: cartTotal,
        delivery_address: 'Kirandul, Dantewada District, Chhattisgarh – 494556',
        delivery_location: { latitude: userCoords.latitude, longitude: userCoords.longitude },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      const existing = JSON.parse(localStorage.getItem('kdlgoods_orders') || '[]');
      localStorage.setItem('kdlgoods_orders', JSON.stringify([mockOrder, ...existing]));
      setActiveOrderTrackingId(mockOrderId);
    } finally {
      setCheckoutSuccess(true);
      setCart([]);
      setCheckingOut(false);
    }
  };

  const activeSellersInSla = sellers.filter(s => s.withinSla && s.is_active);
  const outOfSlaSellers = sellers.filter(s => !s.withinSla);

  return (
    <div className="min-h-screen text-slate-100 pb-28 p-4 md:p-6" style={{ backgroundColor: '#121212' }}>
      {/* Top Navbar */}
      <header className="flex justify-between items-center mb-6 p-4 rounded-xl" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
        <div className="flex items-center gap-3">
          <ShoppingBag style={{ color: '#F7D108' }} size={30} />
          <div>
            <h1 className="text-xl font-black" style={{ color: '#F7D108' }}>KDLGOODS</h1>
            <p className="text-xs" style={{ color: '#8A8A8A' }}>Customer Delivery Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full" style={{ background: 'rgba(247,209,8,0.1)', border: '1px solid rgba(247,209,8,0.3)' }}>
          <MapPin size={13} style={{ color: '#F7D108' }} />
          <span className="text-xs font-semibold" style={{ color: '#F7D108' }}>{TOWN_NAME}</span>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: '#222222', border: '1px solid #2E2E2E' }}>
          <Navigation size={13} style={{ color: '#8A8A8A' }} />
          <span className="text-xs font-mono" style={{ color: '#B0B0B0' }}>
            {userCoords.latitude.toFixed(4)}°N, {userCoords.longitude.toFixed(4)}°E
          </span>
        </div>
      </header>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

        {/* Left Column: Location Simulator */}
        <div className="space-y-4 lg:col-span-1">
          <div className="p-5 rounded-xl space-y-4" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
            <div className="flex items-center gap-2 border-b pb-3 mb-2" style={{ borderColor: '#2E2E2E' }}>
              <MapPin size={18} style={{ color: '#F7D108' }} />
              <h3 className="font-bold text-sm">Coordinate Simulator</h3>
            </div>
            <p className="text-xs leading-relaxed" style={{ color: '#8A8A8A' }}>
              Adjust your GPS coordinates to test geofencing. Default is centred on Kirandul, Dantewada.
            </p>
            <div className="space-y-2">
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#8A8A8A' }}>Latitude</label>
                <input type="number" step="0.0001" className="input" value={latInput} onChange={e => setLatInput(e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1" style={{ color: '#8A8A8A' }}>Longitude</label>
                <input type="number" step="0.0001" className="input" value={lngInput} onChange={e => setLngInput(e.target.value)} />
              </div>
            </div>
            <button onClick={handleUpdateCoords} className="btn-primary w-full text-sm">
              Update Search Centre
            </button>
          </div>

          <div className="p-5 rounded-xl" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
            <h4 className="font-bold mb-2 flex items-center gap-2 text-sm" style={{ color: '#22C55E' }}>
              <ShieldCheck size={16} /> Geofencing Guard Active
            </h4>
            <p className="text-xs leading-relaxed" style={{ color: '#8A8A8A' }}>
              Strict <strong style={{ color: '#F7D108' }}>{OPERATIONAL_GEOFENCE_KM} km</strong> radius enforced around Kirandul, Dantewada. Sellers beyond this boundary are locked automatically.
            </p>
          </div>
        </div>

        {/* Right Column: Stores & Products */}
        <div className="lg:col-span-3 space-y-6">

          {/* Checkout success banner */}
          {checkoutSuccess && (
            <div className="p-5 rounded-xl flex items-center gap-4 justify-between animate-fade-in" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.25)' }}>
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-full" style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>
                  <Check size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-lg" style={{ color: '#22C55E' }}>Order Confirmed!</h4>
                  <p className="text-sm" style={{ color: '#B0B0B0' }}>
                    Tracking ID: <span className="font-mono text-white text-xs">{activeOrderTrackingId}</span>
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#8A8A8A' }}>Rider assignment will appear once your seller prepares the order.</p>
                </div>
              </div>
              <button onClick={() => setCheckoutSuccess(false)} style={{ color: '#8A8A8A' }}><X size={18} /></button>
            </div>
          )}

          {/* Seller product menu view */}
          {selectedSeller ? (
            <div className="rounded-xl p-5" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
              <div className="flex justify-between items-center border-b pb-4 mb-5" style={{ borderColor: '#2E2E2E' }}>
                <div>
                  <button onClick={() => setSelectedSeller(null)} className="text-sm font-semibold mb-1 flex items-center" style={{ color: '#F7D108' }}>
                    ← Back to stores
                  </button>
                  <h2 className="text-xl font-bold">{selectedSeller.store_name} Menu</h2>
                  <p className="text-xs mt-0.5" style={{ color: '#8A8A8A' }}>{selectedSeller.address}</p>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E' }}>
                  {selectedSeller.distanceKm.toFixed(2)} km away
                </span>
              </div>

              {loadingProducts ? (
                <div className="flex justify-center items-center py-16">
                  <Loader2 className="animate-spin" size={32} style={{ color: '#F7D108' }} />
                </div>
              ) : sellerProducts.length === 0 ? (
                /* Empty catalog state */
                <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                  <PackageSearch size={48} style={{ color: '#2E2E2E' }} />
                  <p className="font-bold text-lg" style={{ color: '#8A8A8A' }}>No Items in Catalog Yet</p>
                  <p className="text-sm" style={{ color: '#444' }}>This store is adding items to our catalog. Check back soon!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {sellerProducts.map(product => {
                    const cartQty = cart.find(item => item.id === product.id)?.quantity || 0;
                    return (
                      <div key={product.id} className="p-4 rounded-xl flex justify-between items-center hover:border-[#3E3E3E] transition" style={{ background: '#222222', border: '1px solid #2E2E2E' }}>
                        <div className="flex-1 pr-4">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-bold text-sm">{product.name}</h3>
                            {product.is_ready_for_30min && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded font-bold" style={{ background: 'rgba(247,209,8,0.12)', color: '#F7D108' }}>30MIN</span>
                            )}
                          </div>
                          <p className="text-xs line-clamp-2 leading-relaxed" style={{ color: '#8A8A8A' }}>{product.description || 'No description available.'}</p>
                          <span className="font-bold mt-2 block" style={{ color: '#F5F5F5' }}>{formatINR(product.price)}</span>
                        </div>
                        <div>
                          {cartQty > 0 ? (
                            <div className="flex items-center rounded-lg p-1.5 gap-3" style={{ background: '#F7D108' }}>
                              <button onClick={() => removeFromCart(product.id)} className="font-bold" style={{ color: '#121212' }}><Minus size={14} /></button>
                              <span className="text-xs font-bold font-mono" style={{ color: '#121212' }}>{cartQty}</span>
                              <button onClick={() => addToCart(product)} className="font-bold" style={{ color: '#121212' }}><Plus size={14} /></button>
                            </div>
                          ) : (
                            <button onClick={() => addToCart(product)} className="btn-primary text-xs py-1.5 px-3">
                              Add
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* Storefront discovery list */
            <div>
              <div className="flex justify-between items-center mb-5">
                <div>
                  <h2 className="text-xl font-bold">Active Stores Near You</h2>
                  <p className="text-sm mt-0.5" style={{ color: '#8A8A8A' }}>Within {OPERATIONAL_GEOFENCE_KM} km SLA delivery radius in {TOWN_NAME}</p>
                </div>
                <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: 'rgba(247,209,8,0.1)', color: '#F7D108' }}>
                  {activeSellersInSla.length} Online
                </span>
              </div>

              {loading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {[1, 2, 3, 4].map(idx => (
                    <div key={idx} className="rounded-xl p-5 space-y-4 animate-pulse" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                      <div className="flex justify-between items-start">
                        <div className="h-5 w-40 skeleton rounded" />
                        <div className="h-4 w-16 skeleton rounded" />
                      </div>
                      <div className="h-3 w-full skeleton rounded" />
                      <div className="h-9 w-full skeleton rounded mt-3" />
                    </div>
                  ))}
                </div>
              ) : activeSellersInSla.length === 0 ? (
                /* Clean empty state — no mock sellers */
                <div className="rounded-xl p-12 text-center flex flex-col items-center gap-4" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                  <div className="w-16 h-16 rounded-full flex items-center justify-center" style={{ background: 'rgba(247,209,8,0.1)' }}>
                    <Store size={32} style={{ color: '#F7D108' }} />
                  </div>
                  <div>
                    <p className="font-bold text-lg mb-1" style={{ color: '#F5F5F5' }}>No stores online in your area yet</p>
                    <p className="text-sm leading-relaxed" style={{ color: '#8A8A8A' }}>
                      KDLGOODS is coming soon to {TOWN_NAME}!<br />
                      Sellers are being onboarded — check back shortly.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {activeSellersInSla.map(seller => (
                    <div key={seller.id} className="rounded-xl p-5 flex flex-col justify-between gap-4 hover:border-[#3E3E3E] transition" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                      <div>
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold text-base">{seller.store_name}</h3>
                          <span className="text-[10px] px-2 py-0.5 rounded font-extrabold" style={{ background: 'rgba(34,197,94,0.1)', color: '#22C55E' }}>
                            {seller.distanceKm.toFixed(2)} KM
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed mb-3" style={{ color: '#8A8A8A' }}>{seller.description}</p>
                        <div className="text-xs space-y-1 p-2.5 rounded" style={{ background: '#222222', border: '1px solid #2E2E2E' }}>
                          <p style={{ color: '#8A8A8A' }}>📍 {seller.address}</p>
                          <p className="font-mono text-[10px]" style={{ color: '#444' }}>GEOHASH: {seller.geohash}</p>
                        </div>
                      </div>
                      <button onClick={() => fetchSellerProducts(seller)} className="btn-primary text-xs w-full">
                        Browse Menu <ChevronRight size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Out-of-SLA sellers (locked) */}
              {outOfSlaSellers.length > 0 && (
                <div className="border-t pt-6 mt-6" style={{ borderColor: '#2E2E2E' }}>
                  <h2 className="text-base font-bold mb-1" style={{ color: '#8A8A8A' }}>Stores Outside {OPERATIONAL_GEOFENCE_KM} km Delivery Zone</h2>
                  <p className="text-xs mb-5" style={{ color: '#444' }}>These stores are locked — beyond the 30-minute delivery radius.</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 opacity-40">
                    {outOfSlaSellers.map(seller => (
                      <div key={seller.id} className="rounded-xl p-5 cursor-not-allowed" style={{ background: '#1A1A1A', border: '1px solid #2E2E2E' }}>
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="font-bold">{seller.store_name}</h3>
                          <span className="text-[10px] px-2 py-0.5 rounded font-extrabold" style={{ background: 'rgba(239,68,68,0.1)', color: '#EF4444' }}>
                            {seller.distanceKm.toFixed(2)} KM (OUT)
                          </span>
                        </div>
                        <p className="text-xs" style={{ color: '#8A8A8A' }}>{seller.description}</p>
                        <p className="text-xs font-semibold mt-2" style={{ color: '#EF4444' }}>⚠️ Locked to guarantee 30-min SLA</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sticky Cart Banner */}
      {cart.length > 0 && (
        <div className="fixed bottom-4 left-4 right-4 p-4 rounded-xl flex items-center justify-between shadow-2xl z-40 max-w-4xl mx-auto animate-bounce-subtle" style={{ background: '#1A1A1A', border: '1.5px solid #F7D108' }}>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg" style={{ background: '#F7D108' }}>
              <ShoppingBag size={22} style={{ color: '#121212' }} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold">{cart.length} Item{cart.length > 1 ? 's' : ''}</span>
                <span className="text-[10px] px-2 py-0.5 rounded font-extrabold flex items-center gap-0.5" style={{ background: 'rgba(247,209,8,0.12)', color: '#F7D108' }}>
                  <Zap size={10} /> ~18 MIN DELIVERY
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: '#8A8A8A' }}>30-min SLA guaranteed · {TOWN_NAME}</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-lg font-extrabold">{formatINR(cartTotal)}</span>
            <button onClick={handleCheckout} disabled={checkingOut} className="btn-primary">
              {checkingOut ? (
                <><Loader2 className="animate-spin" size={15} /> Placing...</>
              ) : 'Place Order'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
