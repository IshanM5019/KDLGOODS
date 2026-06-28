import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  TextInput,
  ActivityIndicator,
  Alert,
  Modal,
  Image,
  Dimensions,
  RefreshControl,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
// ─── Inlined from @kdlgoods/shared (avoids monorepo resolution in EAS cloud builds) ───
const DANTEWADA_CENTER = { latitude: 18.8728, longitude: 81.7074 };
const TOWN_NAME = 'Kirandul, Dantewada, Chhattisgarh';
const OPERATIONAL_GEOFENCE_KM = 5;
const CURRENCY_SYMBOL = '₹';
const formatINR = (amount: number, paise = false): string =>
  CURRENCY_SYMBOL +
  amount.toLocaleString('hi-IN', {
    minimumFractionDigits: paise ? 2 : 0,
    maximumFractionDigits: paise ? 2 : 0,
  });
import DeliveryPartnerView from './src/views/DeliveryPartnerView';
import { supabase } from './src/lib/supabase';

// ─── Brand Colors ─────────────────────────────────────────────────────────────
const YELLOW   = '#F7D108';
const BLACK    = '#121212';
const DARK     = '#1A1A1A';
const CHARCOAL = '#222222';
const BORDER   = '#2E2E2E';
const GREY     = '#8A8A8A';
const GREY_LT  = '#B0B0B0';
const GREEN    = '#22C55E';
const RED      = '#EF4444';

const { width: SCREEN_W } = Dimensions.get('window');

// ─── Types ────────────────────────────────────────────────────────────────────
interface Seller {
  id: string;
  store_name: string;
  description: string | null;
  address: string;
  distanceKm: number;
}

interface Product {
  id: string;
  seller_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string;
  is_available: boolean;
  is_ready_for_30min: boolean;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  seller_id: string;
}

// ─── Root App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [userRole, setUserRole] = useState<'customer' | 'seller' | 'delivery' | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [userId, setUserId] = useState<string>('');

  // Auth form
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [signUpRole, setSignUpRole] = useState<'customer' | 'delivery'>('customer');
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session?.user) { setUserRole(null); setUserName(''); setUserId(''); return; }
    setUserId(session.user.id);
    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role, full_name')
          .eq('id', session.user.id)
          .single();
        if (!error && data) {
          setUserRole(data.role as any);
          setUserName(data.full_name || 'User');
        } else {
          setUserRole(session.user.user_metadata?.role || 'customer');
          setUserName(session.user.user_metadata?.full_name || 'User');
        }
      } catch {
        setUserRole(session.user.user_metadata?.role || 'customer');
        setUserName(session.user.user_metadata?.full_name || 'User');
      }
    };
    fetchProfile();
  }, [session]);

  const handleSignIn = async () => {
    if (!email || !password) { setAuthError('Please fill in all fields'); return; }
    setLoadingAuth(true); setAuthError(null);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      setAuthError(err.message || 'Incorrect email or password');
    } finally { setLoadingAuth(false); }
  };

  const handleSignUp = async () => {
    if (!email || !password || !fullName || !phoneNumber) {
      setAuthError('Please fill all fields including phone number'); return;
    }
    if (phoneNumber.replace(/[^0-9]/g, '').length < 10) {
      setAuthError('Enter a valid 10-digit mobile number'); return;
    }
    setLoadingAuth(true); setAuthError(null);
    try {
      const { error } = await supabase.auth.signUp({
        email, password, phone: phoneNumber,
        options: { data: { full_name: fullName, role: signUpRole, phone_number: phoneNumber } },
      });
      if (error) throw error;
      Alert.alert('Success', 'Account created! Please sign in.');
      setIsSignUp(false); setPassword('');
    } catch (err: any) {
      setAuthError(err.message || 'Registration failed');
    } finally { setLoadingAuth(false); }
  };

  const handleSignOut = async () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  };

  // ── Loading splash ──────────────────────────────────────────────────────────
  if (loadingSession) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <StatusBar barStyle="light-content" backgroundColor={BLACK} />
        <Text style={styles.splashLogo}>⚡ KDLGOODS</Text>
        <ActivityIndicator size="large" color={YELLOW} style={{ marginTop: 20 }} />
      </SafeAreaView>
    );
  }

  // ── Auth Screen ─────────────────────────────────────────────────────────────
  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={BLACK} />
        <ScrollView contentContainerStyle={styles.authScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.authHeader}>
            <Text style={styles.logo}>⚡ KDLGOODS</Text>
            <Text style={styles.subtitle}>30-Min Hyper-Local Delivery · {TOWN_NAME}</Text>
          </View>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
            {authError && <Text style={styles.errorText}>{authError}</Text>}
            {isSignUp && (
              <>
                <Text style={styles.label}>FULL NAME *</Text>
                <TextInput style={styles.input} placeholder="e.g. Anil Kumar" placeholderTextColor={GREY} value={fullName} onChangeText={setFullName} />
                <Text style={styles.label}>ROLE *</Text>
                <View style={styles.roleContainer}>
                  <TouchableOpacity style={[styles.roleButton, signUpRole === 'customer' && styles.activeRoleButton]} onPress={() => setSignUpRole('customer')}>
                    <Text style={[styles.roleButtonText, signUpRole === 'customer' && styles.activeRoleButtonText]}>🛒 Customer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.roleButton, signUpRole === 'delivery' && styles.activeRoleButton]} onPress={() => setSignUpRole('delivery')}>
                    <Text style={[styles.roleButtonText, signUpRole === 'delivery' && styles.activeRoleButtonText]}>🛵 Delivery</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.label}>PHONE NUMBER *</Text>
                <TextInput style={styles.input} placeholder="e.g. 9876543210" placeholderTextColor={GREY} keyboardType="phone-pad" value={phoneNumber} onChangeText={setPhoneNumber} />
              </>
            )}
            <Text style={styles.label}>EMAIL ADDRESS *</Text>
            <TextInput style={styles.input} placeholder="you@example.com" placeholderTextColor={GREY} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
            <Text style={styles.label}>PASSWORD *</Text>
            <TextInput style={styles.input} placeholder="••••••••" placeholderTextColor={GREY} secureTextEntry autoCapitalize="none" value={password} onChangeText={setPassword} />
            <TouchableOpacity style={styles.btnPrimary} onPress={isSignUp ? handleSignUp : handleSignIn} disabled={loadingAuth}>
              {loadingAuth ? <ActivityIndicator size="small" color={BLACK} /> : <Text style={styles.btnPrimaryText}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.linkButton} onPress={() => { setIsSignUp(!isSignUp); setAuthError(null); }}>
              <Text style={styles.linkText}>{isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── Delivery Partner ────────────────────────────────────────────────────────
  if (userRole === 'delivery') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={BLACK} />
        <View style={styles.profileHeader}>
          <View>
            <Text style={styles.profileName}>{userName}</Text>
            <Text style={styles.profileRole}>🛵 Verified Delivery Partner</Text>
          </View>
          <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
            <Text style={styles.signOutBtnText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
        <DeliveryPartnerView driverId={session.user.id} />
      </SafeAreaView>
    );
  }

  // ── Customer View ───────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BLACK} />
      <View style={styles.profileHeader}>
        <View>
          <Text style={styles.profileName}>{userName || 'Customer'}</Text>
          <Text style={styles.profileRole}>🛒 KDLGOODS Customer</Text>
        </View>
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutBtnText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
      <CustomerView customerId={userId} />
    </SafeAreaView>
  );
}

// ─── Customer Shopping View ───────────────────────────────────────────────────
function CustomerView({ customerId }: { customerId: string }) {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loadingSellers, setLoadingSellers] = useState(true);
  const [locationGranted, setLocationGranted] = useState(false);
  const [userCoords, setUserCoords] = useState({ latitude: DANTEWADA_CENTER.latitude, longitude: DANTEWADA_CENTER.longitude });
  const [refreshing, setRefreshing] = useState(false);

  // Store → Products
  const [selectedSeller, setSelectedSeller] = useState<Seller | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(false);

  // Cart
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCart, setShowCart] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [orderSuccess, setOrderSuccess] = useState(false);

  // Lightbox
  const [lightboxProduct, setLightboxProduct] = useState<Product | null>(null);

  // ── Location ──────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setLocationGranted(true);
        try {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        } catch { /* use default */ }
      }
      fetchSellers();
    })();
  }, []);

  const fetchSellers = async () => {
    setLoadingSellers(true);
    try {
      const { data, error } = await supabase.rpc('get_nearby_sellers', {
        customer_lat: userCoords.latitude,
        customer_lng: userCoords.longitude,
        max_distance_meters: OPERATIONAL_GEOFENCE_KM * 1000,
      });
      if (error) throw error;
      const mapped: Seller[] = (data || []).map((s: any) => ({
        id: s.id,
        store_name: s.store_name,
        description: s.description,
        address: s.address,
        distanceKm: (s.distance_meters / 1000),
      }));
      setSellers(mapped);
    } catch {
      setSellers([]);
    } finally {
      setLoadingSellers(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchSellers();
  }, [userCoords]);

  const openStore = async (seller: Seller) => {
    setSelectedSeller(seller);
    setLoadingProducts(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('seller_id', seller.id)
        .eq('is_available', true);
      if (error) throw error;
      setProducts(data || []);
    } catch {
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  };

  // ── Cart helpers ──────────────────────────────────────────────────────────
  const cartTotal = cart.reduce((acc, i) => acc + i.price * i.quantity, 0);
  const cartCount = cart.reduce((acc, i) => acc + i.quantity, 0);
  const DELIVERY_FEE = 25;

  const addToCart = (product: Product) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === product.id);
      if (ex) return prev.map(i => i.id === product.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { id: product.id, name: product.name, price: product.price, quantity: 1, seller_id: selectedSeller!.id }];
    });
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => {
      const ex = prev.find(i => i.id === productId);
      if (ex && ex.quantity > 1) return prev.map(i => i.id === productId ? { ...i, quantity: i.quantity - 1 } : i);
      return prev.filter(i => i.id !== productId);
    });
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setCheckingOut(true);
    try {
      const orderPayload = {
        customer_id: customerId,
        seller_id: selectedSeller!.id,
        status: 'placed',
        total_amount: cartTotal + DELIVERY_FEE,
        items_total: cartTotal,
        delivery_partner_fee: DELIVERY_FEE,
        handling_charge: 0,
        small_cart_fee: 0,
        delivery_address: `${TOWN_NAME} — App Order`,
        delivery_location: { latitude: DANTEWADA_CENTER.latitude, longitude: DANTEWADA_CENTER.longitude },
        payment_method: 'cod',
        payment_status: 'pending',
        driver_cash_submitted: false,
      };
      const { data: orderData, error: orderErr } = await supabase.from('orders').insert([orderPayload]).select().single();
      if (orderErr) throw orderErr;

      const orderItems = cart.map(item => ({
        order_id: orderData.id,
        product_id: item.id,
        quantity: item.quantity,
        price_at_order: item.price,
      }));
      const { error: itemsErr } = await supabase.from('order_items').insert(orderItems);
      if (itemsErr) throw itemsErr;

      setCart([]);
      setShowCart(false);
      setOrderSuccess(true);
    } catch (err: any) {
      Alert.alert('Checkout Failed', err.message || 'Could not place order. Please try again.');
    } finally {
      setCheckingOut(false);
    }
  };

  const getCartQty = (productId: string) => cart.find(i => i.id === productId)?.quantity || 0;

  // ── Order Success Screen ──────────────────────────────────────────────────
  if (orderSuccess) {
    return (
      <View style={[styles.flex1, styles.center, { paddingHorizontal: 24 }]}>
        <Text style={{ fontSize: 64 }}>🎉</Text>
        <Text style={[styles.cardTitle, { textAlign: 'center', marginTop: 16, color: GREEN }]}>Order Placed!</Text>
        <Text style={[styles.bodyText, { textAlign: 'center', marginTop: 8 }]}>
          Your order is being prepared. Expect delivery within 30 minutes!
        </Text>
        <TouchableOpacity
          style={[styles.btnPrimary, { marginTop: 32, paddingHorizontal: 48 }]}
          onPress={() => { setOrderSuccess(false); setSelectedSeller(null); }}
        >
          <Text style={styles.btnPrimaryText}>Back to Stores</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Product Image Lightbox ────────────────────────────────────────────────
  const renderLightbox = () => (
    <Modal visible={!!lightboxProduct} transparent animationType="fade" onRequestClose={() => setLightboxProduct(null)}>
      <TouchableOpacity style={styles.lightboxBackdrop} activeOpacity={1} onPress={() => setLightboxProduct(null)}>
        <View style={styles.lightboxCard}>
          <View style={styles.lightboxHeader}>
            <Text style={styles.lightboxTitle} numberOfLines={1}>{lightboxProduct?.name}</Text>
            <TouchableOpacity onPress={() => setLightboxProduct(null)} style={styles.lightboxClose}>
              <Text style={{ color: GREY, fontSize: 20, fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
          </View>
          {lightboxProduct?.image_url ? (
            <Image
              source={{ uri: lightboxProduct.image_url }}
              style={styles.lightboxImage}
              resizeMode="contain"
            />
          ) : (
            <View style={[styles.lightboxImage, styles.center]}>
              <Text style={{ fontSize: 48 }}>📦</Text>
              <Text style={[styles.label, { marginTop: 8 }]}>No photo available</Text>
            </View>
          )}
          <View style={styles.lightboxFooter}>
            <Text style={styles.lightboxPrice}>{formatINR(lightboxProduct?.price || 0)}</Text>
            {lightboxProduct && (
              <TouchableOpacity
                style={[styles.btnPrimary, { paddingVertical: 10, paddingHorizontal: 24 }]}
                onPress={() => { addToCart(lightboxProduct); setLightboxProduct(null); }}
              >
                <Text style={styles.btnPrimaryText}>Add to Cart</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  // ── Cart Modal ────────────────────────────────────────────────────────────
  const renderCart = () => (
    <Modal visible={showCart} transparent animationType="slide" onRequestClose={() => setShowCart(false)}>
      <View style={styles.cartBackdrop}>
        <View style={styles.cartSheet}>
          <View style={styles.cartHeader}>
            <Text style={styles.cartTitle}>Your Cart</Text>
            <TouchableOpacity onPress={() => setShowCart(false)}>
              <Text style={{ color: GREY, fontSize: 20, fontWeight: '700' }}>✕</Text>
            </TouchableOpacity>
          </View>

          {cart.length === 0 ? (
            <View style={[styles.center, { paddingVertical: 40 }]}>
              <Text style={{ fontSize: 40, marginBottom: 12 }}>🛒</Text>
              <Text style={styles.emptyTitle}>Cart is empty</Text>
            </View>
          ) : (
            <>
              <ScrollView style={{ maxHeight: 300 }}>
                {cart.map(item => (
                  <View key={item.id} style={styles.cartItem}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.cartItemName}>{item.name}</Text>
                      <Text style={styles.cartItemPrice}>{formatINR(item.price)} each</Text>
                    </View>
                    <View style={styles.qtyRow}>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => removeFromCart(item.id)}>
                        <Text style={styles.qtyBtnText}>−</Text>
                      </TouchableOpacity>
                      <Text style={styles.qtyCount}>{item.quantity}</Text>
                      <TouchableOpacity style={styles.qtyBtn} onPress={() => addToCart({ ...item, seller_id: item.seller_id, description: null, category: '', is_available: true, is_ready_for_30min: false, image_url: null } as any)}>
                        <Text style={styles.qtyBtnText}>+</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>

              <View style={styles.billSummary}>
                <View style={styles.billRow}><Text style={styles.billLabel}>Items total</Text><Text style={styles.billValue}>{formatINR(cartTotal)}</Text></View>
                <View style={styles.billRow}><Text style={styles.billLabel}>Delivery fee</Text><Text style={styles.billValue}>{formatINR(DELIVERY_FEE)}</Text></View>
                <View style={[styles.billRow, styles.billTotal]}>
                  <Text style={styles.billTotalLabel}>Grand Total</Text>
                  <Text style={styles.billTotalValue}>{formatINR(cartTotal + DELIVERY_FEE)}</Text>
                </View>
              </View>

              <View style={styles.codBadge}>
                <Text style={styles.codText}>💵 Cash on Delivery — Pay when your order arrives</Text>
              </View>

              <TouchableOpacity style={styles.btnPrimary} onPress={handleCheckout} disabled={checkingOut}>
                {checkingOut ? <ActivityIndicator size="small" color={BLACK} /> : <Text style={styles.btnPrimaryText}>Place Order · {formatINR(cartTotal + DELIVERY_FEE)}</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </View>
    </Modal>
  );

  // ── Product Card ──────────────────────────────────────────────────────────
  const renderProduct = ({ item }: { item: Product }) => {
    const qty = getCartQty(item.id);
    return (
      <View style={styles.productCard}>
        <TouchableOpacity onPress={() => setLightboxProduct(item)} activeOpacity={0.85}>
          {item.image_url ? (
            <Image source={{ uri: item.image_url }} style={styles.productImage} resizeMode="cover" />
          ) : (
            <View style={[styles.productImage, styles.productImagePlaceholder]}>
              <Text style={{ fontSize: 32 }}>📦</Text>
              <Text style={[styles.label, { marginTop: 4 }]}>No Photo</Text>
            </View>
          )}
          {item.is_ready_for_30min && (
            <View style={styles.thirtyMinBadge}>
              <Text style={styles.thirtyMinText}>⚡ 30MIN</Text>
            </View>
          )}
          {item.image_url && (
            <View style={styles.viewPhotoBadge}>
              <Text style={styles.viewPhotoText}>🔍 View</Text>
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={1}>{item.name}</Text>
          {item.description ? <Text style={styles.productDesc} numberOfLines={2}>{item.description}</Text> : null}
          <View style={styles.productFooter}>
            <Text style={styles.productPrice}>{formatINR(item.price)}</Text>
            {qty > 0 ? (
              <View style={styles.qtyRow}>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => removeFromCart(item.id)}>
                  <Text style={styles.qtyBtnText}>−</Text>
                </TouchableOpacity>
                <Text style={styles.qtyCount}>{qty}</Text>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => addToCart(item)}>
                  <Text style={styles.qtyBtnText}>+</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.addBtn} onPress={() => addToCart(item)}>
                <Text style={styles.addBtnText}>+ Add</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    );
  };

  // ── Seller List ───────────────────────────────────────────────────────────
  if (!selectedSeller) {
    return (
      <View style={styles.flex1}>
        {/* Search / Location Bar */}
        <View style={styles.topBar}>
          <Text style={styles.topBarLeft}>📍 {TOWN_NAME}</Text>
          <Text style={styles.topBarRight}>{locationGranted ? '🟢 GPS Active' : '⚪ Default Location'}</Text>
        </View>

        {/* Hero Banner */}
        <View style={styles.heroBanner}>
          <Text style={styles.heroTitle}>⚡ 30-Minute Delivery</Text>
          <Text style={styles.heroSub}>Shop from local stores in {TOWN_NAME}</Text>
        </View>

        {loadingSellers ? (
          <View style={[styles.flex1, styles.center]}>
            <ActivityIndicator size="large" color={YELLOW} />
            <Text style={[styles.label, { marginTop: 12 }]}>Finding stores near you...</Text>
          </View>
        ) : sellers.length === 0 ? (
          <ScrollView
            contentContainerStyle={[styles.center, { flexGrow: 1, padding: 24 }]}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={YELLOW} />}
          >
            <Text style={{ fontSize: 64 }}>🏪</Text>
            <Text style={[styles.emptyTitle, { marginTop: 16 }]}>No Stores Online</Text>
            <Text style={[styles.bodyText, { textAlign: 'center', marginTop: 8 }]}>
              KDLGOODS is launching in {TOWN_NAME}!{'\n'}Local sellers are being onboarded — check back soon.
            </Text>
            <TouchableOpacity style={[styles.btnPrimary, { marginTop: 24 }]} onPress={onRefresh}>
              <Text style={styles.btnPrimaryText}>Refresh</Text>
            </TouchableOpacity>
          </ScrollView>
        ) : (
          <FlatList
            data={sellers}
            keyExtractor={s => s.id}
            contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={YELLOW} />}
            ListHeaderComponent={
              <Text style={[styles.sectionTitle, { marginBottom: 12 }]}>
                {sellers.length} Store{sellers.length > 1 ? 's' : ''} Near You
              </Text>
            }
            renderItem={({ item: seller }) => (
              <View style={styles.sellerCard}>
                <View style={styles.sellerCardTop}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.sellerName}>{seller.store_name}</Text>
                    {seller.description ? <Text style={styles.sellerDesc} numberOfLines={2}>{seller.description}</Text> : null}
                  </View>
                  <View style={styles.distancePill}>
                    <Text style={styles.distanceText}>{seller.distanceKm.toFixed(2)} km</Text>
                  </View>
                </View>
                <Text style={styles.sellerAddress} numberOfLines={1}>📍 {seller.address}</Text>
                <TouchableOpacity style={[styles.btnPrimary, { marginTop: 14 }]} onPress={() => openStore(seller)}>
                  <Text style={styles.btnPrimaryText}>Browse Menu →</Text>
                </TouchableOpacity>
              </View>
            )}
          />
        )}
      </View>
    );
  }

  // ── Products Screen ───────────────────────────────────────────────────────
  return (
    <View style={styles.flex1}>
      {renderLightbox()}
      {renderCart()}

      {/* Back + Store Header */}
      <View style={styles.storeHeader}>
        <TouchableOpacity onPress={() => { setSelectedSeller(null); setCart([]); }} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Back</Text>
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.storeName}>{selectedSeller.store_name}</Text>
          <Text style={styles.storeDistance}>{selectedSeller.distanceKm.toFixed(2)} km away · 30-min delivery</Text>
        </View>
      </View>

      {loadingProducts ? (
        <View style={[styles.flex1, styles.center]}>
          <ActivityIndicator size="large" color={YELLOW} />
          <Text style={[styles.label, { marginTop: 12 }]}>Loading menu...</Text>
        </View>
      ) : products.length === 0 ? (
        <View style={[styles.flex1, styles.center, { padding: 32 }]}>
          <Text style={{ fontSize: 48 }}>📭</Text>
          <Text style={[styles.emptyTitle, { marginTop: 12 }]}>No Items Yet</Text>
          <Text style={[styles.bodyText, { textAlign: 'center', marginTop: 8 }]}>This store is adding items. Check back soon!</Text>
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={p => p.id}
          numColumns={2}
          contentContainerStyle={{ padding: 12, paddingBottom: 120 }}
          columnWrapperStyle={{ gap: 12 }}
          renderItem={renderProduct}
        />
      )}

      {/* Sticky Cart Bar */}
      {cartCount > 0 && (
        <TouchableOpacity style={styles.cartBar} onPress={() => setShowCart(true)}>
          <View style={styles.cartBarLeft}>
            <View style={styles.cartBarBadge}><Text style={styles.cartBarBadgeText}>{cartCount}</Text></View>
            <Text style={styles.cartBarLabel}>{cartCount} item{cartCount > 1 ? 's' : ''} · ⚡ ~18 min</Text>
          </View>
          <Text style={styles.cartBarTotal}>{formatINR(cartTotal + DELIVERY_FEE)} →</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  flex1: { flex: 1 },
  container: { flex: 1, backgroundColor: BLACK },
  center: { justifyContent: 'center', alignItems: 'center' },

  // Splash
  splashLogo: { fontSize: 36, fontWeight: '900', color: YELLOW, letterSpacing: -0.5 },

  // Auth
  authScroll: { padding: 24, justifyContent: 'center', flexGrow: 1 },
  authHeader: { alignItems: 'center', marginBottom: 32 },

  // Profile header
  profileHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: DARK, borderBottomWidth: 1, borderBottomColor: BORDER,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  profileName: { color: '#fff', fontSize: 14, fontWeight: '800' },
  profileRole: { color: YELLOW, fontSize: 11, fontWeight: '700', marginTop: 2 },
  signOutBtn: { backgroundColor: CHARCOAL, borderWidth: 1, borderColor: BORDER, borderRadius: 6, paddingHorizontal: 12, paddingVertical: 6 },
  signOutBtnText: { color: RED, fontSize: 12, fontWeight: '700' },

  // Common
  logo: { fontSize: 32, fontWeight: '900', color: YELLOW, letterSpacing: -0.5, textAlign: 'center' },
  subtitle: { fontSize: 13, color: GREY, marginTop: 4, textAlign: 'center' },
  card: { backgroundColor: DARK, borderRadius: 14, padding: 18, marginBottom: 20, borderWidth: 1, borderColor: BORDER },
  cardTitle: { fontSize: 20, fontWeight: '800', color: '#F5F5F5', marginBottom: 16 },
  sectionTitle: { fontSize: 16, fontWeight: '800', color: '#F5F5F5' },
  bodyText: { fontSize: 13, color: GREY_LT, lineHeight: 20 },
  label: { fontSize: 10, fontWeight: '800', color: GREY, marginBottom: 6, letterSpacing: 0.5 },
  emptyTitle: { fontSize: 16, fontWeight: '800', color: GREY, textAlign: 'center' },
  emptyBody: { fontSize: 13, color: '#666', textAlign: 'center', lineHeight: 20 },
  errorText: { color: RED, fontSize: 12, fontWeight: '700', textAlign: 'center', marginBottom: 12 },

  // Inputs
  input: { backgroundColor: CHARCOAL, borderWidth: 1, borderColor: BORDER, borderRadius: 8, padding: 12, color: '#fff', fontSize: 14, marginBottom: 14 },
  roleContainer: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  roleButton: { flex: 1, paddingVertical: 12, borderRadius: 8, borderWidth: 1, borderColor: BORDER, alignItems: 'center', backgroundColor: CHARCOAL },
  activeRoleButton: { backgroundColor: YELLOW, borderColor: YELLOW },
  roleButtonText: { fontSize: 12, fontWeight: '700', color: GREY_LT },
  activeRoleButtonText: { color: BLACK, fontWeight: '800' },

  // Buttons
  btnPrimary: { backgroundColor: YELLOW, borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 10 },
  btnPrimaryText: { color: BLACK, fontWeight: '800', fontSize: 15 },
  linkButton: { alignItems: 'center', marginTop: 18 },
  linkText: { color: YELLOW, fontSize: 12, fontWeight: '600' },

  // Top bar
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: DARK, borderBottomWidth: 1, borderBottomColor: BORDER },
  topBarLeft: { color: '#fff', fontSize: 13, fontWeight: '700' },
  topBarRight: { color: GREY, fontSize: 11 },

  // Hero
  heroBanner: { paddingHorizontal: 16, paddingVertical: 14, backgroundColor: CHARCOAL, borderBottomWidth: 1, borderBottomColor: BORDER },
  heroTitle: { color: YELLOW, fontSize: 18, fontWeight: '900' },
  heroSub: { color: GREY, fontSize: 12, marginTop: 2 },

  // Seller card
  sellerCard: { backgroundColor: DARK, borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: BORDER },
  sellerCardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 8 },
  sellerName: { color: '#fff', fontSize: 16, fontWeight: '800', marginBottom: 4 },
  sellerDesc: { color: GREY, fontSize: 12, lineHeight: 18 },
  sellerAddress: { color: GREY, fontSize: 11, marginTop: 4 },
  distancePill: { backgroundColor: 'rgba(34,197,94,0.12)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
  distanceText: { color: GREEN, fontSize: 11, fontWeight: '800' },

  // Store header
  storeHeader: { flexDirection: 'row', alignItems: 'center', backgroundColor: DARK, borderBottomWidth: 1, borderBottomColor: BORDER, paddingHorizontal: 16, paddingVertical: 12 },
  backBtn: { paddingVertical: 4 },
  backBtnText: { color: YELLOW, fontSize: 14, fontWeight: '700' },
  storeName: { color: '#fff', fontSize: 15, fontWeight: '800' },
  storeDistance: { color: GREY, fontSize: 11, marginTop: 2 },

  // Product card (2-col grid)
  productCard: {
    flex: 1, backgroundColor: CHARCOAL, borderRadius: 12, overflow: 'hidden',
    borderWidth: 1, borderColor: BORDER, marginBottom: 12,
    maxWidth: (SCREEN_W - 12 * 3) / 2,
  },
  productImage: { width: '100%', height: 140, backgroundColor: DARK },
  productImagePlaceholder: { alignItems: 'center', justifyContent: 'center' },
  thirtyMinBadge: { position: 'absolute', top: 6, left: 6, backgroundColor: 'rgba(247,209,8,0.92)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  thirtyMinText: { color: BLACK, fontSize: 9, fontWeight: '900' },
  viewPhotoBadge: { position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 4, paddingHorizontal: 6, paddingVertical: 2 },
  viewPhotoText: { color: '#fff', fontSize: 9, fontWeight: '700' },
  productInfo: { padding: 10 },
  productName: { color: '#fff', fontSize: 13, fontWeight: '800', marginBottom: 3 },
  productDesc: { color: GREY, fontSize: 11, lineHeight: 16, marginBottom: 6 },
  productFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  productPrice: { color: '#F5F5F5', fontSize: 14, fontWeight: '900' },
  addBtn: { backgroundColor: YELLOW, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 6 },
  addBtnText: { color: BLACK, fontSize: 12, fontWeight: '800' },
  qtyRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: YELLOW, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 4, gap: 6 },
  qtyBtn: { paddingHorizontal: 4 },
  qtyBtnText: { color: BLACK, fontSize: 16, fontWeight: '900', lineHeight: 18 },
  qtyCount: { color: BLACK, fontSize: 13, fontWeight: '900', minWidth: 16, textAlign: 'center' },

  // Cart bar
  cartBar: {
    position: 'absolute', bottom: 16, left: 16, right: 16,
    backgroundColor: YELLOW, borderRadius: 12,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    shadowColor: YELLOW, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 12, elevation: 8,
  },
  cartBarLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cartBarBadge: { backgroundColor: BLACK, borderRadius: 999, width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  cartBarBadgeText: { color: YELLOW, fontSize: 11, fontWeight: '900' },
  cartBarLabel: { color: BLACK, fontSize: 13, fontWeight: '800' },
  cartBarTotal: { color: BLACK, fontSize: 15, fontWeight: '900' },

  // Cart modal
  cartBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  cartSheet: { backgroundColor: DARK, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 },
  cartHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: BORDER },
  cartTitle: { color: '#fff', fontSize: 18, fontWeight: '900' },
  cartItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: BORDER },
  cartItemName: { color: '#fff', fontSize: 13, fontWeight: '700' },
  cartItemPrice: { color: GREY, fontSize: 11, marginTop: 2 },
  billSummary: { marginTop: 16, marginBottom: 12 },
  billRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  billLabel: { color: GREY, fontSize: 13 },
  billValue: { color: GREY_LT, fontSize: 13 },
  billTotal: { borderTopWidth: 1, borderTopColor: BORDER, paddingTop: 10, marginTop: 4 },
  billTotalLabel: { color: '#fff', fontSize: 14, fontWeight: '800' },
  billTotalValue: { color: YELLOW, fontSize: 16, fontWeight: '900' },
  codBadge: { backgroundColor: 'rgba(34,197,94,0.08)', borderWidth: 1, borderColor: 'rgba(34,197,94,0.2)', borderRadius: 8, padding: 10, marginBottom: 12 },
  codText: { color: GREEN, fontSize: 12, fontWeight: '600', textAlign: 'center' },

  // Lightbox
  lightboxBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'center', alignItems: 'center', padding: 16 },
  lightboxCard: { backgroundColor: DARK, borderRadius: 16, overflow: 'hidden', width: '100%', borderWidth: 1, borderColor: BORDER },
  lightboxHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: BORDER },
  lightboxTitle: { color: '#fff', fontSize: 14, fontWeight: '800', flex: 1, marginRight: 12 },
  lightboxClose: { padding: 4 },
  lightboxImage: { width: '100%', height: 300, backgroundColor: '#111' },
  lightboxFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 14, borderTopWidth: 1, borderTopColor: BORDER },
  lightboxPrice: { color: YELLOW, fontSize: 20, fontWeight: '900' },
});
