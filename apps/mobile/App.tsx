import React, { useState, useEffect } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ScrollView, 
  TouchableOpacity, 
  SafeAreaView, 
  StatusBar,
  TextInput,
  ActivityIndicator,
  Alert
} from 'react-native';
import { DANTEWADA_CENTER, TOWN_NAME, OPERATIONAL_GEOFENCE_KM, formatINR } from '@kdlgoods/shared';
import DeliveryPartnerView from './src/views/DeliveryPartnerView';
import { supabase } from './src/lib/supabase';

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
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [userRole, setUserRole] = useState<'customer' | 'delivery' | null>(null);
  const [userName, setUserName] = useState<string>('');

  // Auth form states
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [signUpRole, setSignUpRole] = useState<'customer' | 'delivery'>('customer');
  const [loadingAuth, setLoadingAuth] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    // Check initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoadingSession(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setUserRole(null);
      setUserName('');
      return;
    }

    const fetchProfile = async () => {
      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('role, full_name')
          .eq('id', session.user.id)
          .single();

        if (!error && data) {
          setUserRole(data.role as 'customer' | 'delivery');
          setUserName(data.full_name);
        } else {
          // Fallback to metadata
          setUserRole(session.user.user_metadata?.role || 'customer');
          setUserName(session.user.user_metadata?.full_name || 'User');
        }
      } catch (err) {
        setUserRole(session.user.user_metadata?.role || 'customer');
        setUserName(session.user.user_metadata?.full_name || 'User');
      }
    };
    fetchProfile();
  }, [session]);

  const handleSignIn = async () => {
    if (!email || !password) {
      setAuthError('Please fill in all fields');
      return;
    }
    setLoadingAuth(true);
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
    } catch (err: any) {
      setAuthError(err.message || 'Incorrect email or password');
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleSignUp = async () => {
    if (!email || !password || !fullName || !phoneNumber) {
      setAuthError('Please fill in all required fields including Phone Number');
      return;
    }
    if (phoneNumber.replace(/[^0-9]/g, '').length < 10) {
      setAuthError('Please enter a valid 10-digit mobile number');
      return;
    }
    setLoadingAuth(true);
    setAuthError(null);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        phone: phoneNumber,
        options: {
          data: {
            full_name: fullName,
            role: signUpRole,
            phone_number: phoneNumber,
          },
        },
      });
      if (error) throw error;

      Alert.alert(
        'Success',
        'Account created successfully! Please sign in.'
      );
      setIsSignUp(false);
      setPassword('');
    } catch (err: any) {
      setAuthError(err.message || 'Registration failed');
    } finally {
      setLoadingAuth(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  if (loadingSession) {
    return (
      <SafeAreaView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={YELLOW} />
      </SafeAreaView>
    );
  }

  // Unauthenticated: Show AuthScreen
  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" backgroundColor={BLACK} />
        <ScrollView contentContainerStyle={styles.authScroll}>
          <View style={styles.authHeader}>
            <Text style={styles.logo}>KDLGOODS ⚡</Text>
            <Text style={styles.subtitle}>Kirandul Hyper-Local Delivery</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>{isSignUp ? 'Create Account' : 'Sign In'}</Text>
            
            {authError && <Text style={styles.errorText}>{authError}</Text>}

            {isSignUp && (
              <>
                <Text style={styles.label}>FULL NAME *</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="e.g. Anil Kumar"
                  placeholderTextColor={GREY}
                  value={fullName}
                  onChangeText={setFullName}
                />

                <Text style={styles.label}>ROLE *</Text>
                <View style={styles.roleContainer}>
                  <TouchableOpacity 
                    style={[styles.roleButton, signUpRole === 'customer' && styles.activeRoleButton]}
                    onPress={() => setSignUpRole('customer')}
                  >
                    <Text style={[styles.roleButtonText, signUpRole === 'customer' && styles.activeRoleButtonText]}>🛒 Customer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity 
                    style={[styles.roleButton, signUpRole === 'delivery' && styles.activeRoleButton]}
                    onPress={() => setSignUpRole('delivery')}
                  >
                    <Text style={[styles.roleButtonText, signUpRole === 'delivery' && styles.activeRoleButtonText]}>🛵 Delivery Rider</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>PHONE NUMBER (REQUIRED)</Text>
                <TextInput 
                  style={styles.input} 
                  placeholder="e.g. 9876543210"
                  placeholderTextColor={GREY}
                  keyboardType="phone-pad"
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                />
              </>
            )}

            <Text style={styles.label}>EMAIL ADDRESS *</Text>
            <TextInput 
              style={styles.input} 
              placeholder="e.g. anil@example.com"
              placeholderTextColor={GREY}
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
            />

            <Text style={styles.label}>PASSWORD *</Text>
            <TextInput 
              style={styles.input} 
              placeholder="••••••••"
              placeholderTextColor={GREY}
              secureTextEntry
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
            />

            <TouchableOpacity 
              style={styles.btnPrimary} 
              onPress={isSignUp ? handleSignUp : handleSignIn}
              disabled={loadingAuth}
            >
              {loadingAuth ? (
                <ActivityIndicator size="small" color={BLACK} />
              ) : (
                <Text style={styles.btnPrimaryText}>{isSignUp ? 'Sign Up' : 'Sign In'}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.linkButton} 
              onPress={() => {
                setIsSignUp(!isSignUp);
                setAuthError(null);
              }}
            >
              <Text style={styles.linkText}>
                {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Authenticated Screen Layout
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={BLACK} />

      {/* Account Info Header */}
      <View style={styles.profileHeader}>
        <View>
          <Text style={styles.profileName}>{userName}</Text>
          <Text style={styles.profileRole}>
            {userRole === 'delivery' ? '🛵 Verified Delivery Partner' : '🛒 Customer Portal'}
          </Text>
        </View>
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Text style={styles.signOutBtnText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {userRole === 'delivery' ? (
        <DeliveryPartnerView driverId={session.user.id} />
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
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  authScroll: {
    padding: 20,
    justifyContent: 'center',
    flexGrow: 1,
  },
  authHeader: {
    alignItems: 'center',
    marginBottom: 30,
  },
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: DARK,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  profileName: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  profileRole: {
    color: YELLOW,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  signOutBtn: {
    backgroundColor: CHARCOAL,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  signOutBtnText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
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
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 13,
    color: GREY,
    marginTop: 4,
    textAlign: 'center',
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
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F5F5F5',
    marginBottom: 16,
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
  label: {
    fontSize: 10,
    fontWeight: '800',
    color: GREY,
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: CHARCOAL,
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 8,
    padding: 12,
    color: '#ffffff',
    fontSize: 14,
    marginBottom: 15,
  },
  roleContainer: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 15,
  },
  roleButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    backgroundColor: CHARCOAL,
  },
  activeRoleButton: {
    backgroundColor: YELLOW,
    borderColor: YELLOW,
  },
  roleButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: GREY_LT,
  },
  activeRoleButtonText: {
    color: BLACK,
    fontWeight: '800',
  },
  btnPrimary: {
    backgroundColor: YELLOW,
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
  },
  btnPrimaryText: {
    color: BLACK,
    fontWeight: '800',
    fontSize: 15,
  },
  linkButton: {
    alignItems: 'center',
    marginTop: 18,
  },
  linkText: {
    color: YELLOW,
    fontSize: 12,
    fontWeight: '600',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 15,
  },
});
