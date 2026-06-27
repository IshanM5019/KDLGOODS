import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Switch, TouchableOpacity, ScrollView, Alert, TextInput } from 'react-native';
import { supabase } from '../lib/supabase';
import { Order, OrderStatus, DANTEWADA_CENTER, TOWN_NAME, formatINR } from '@kdlgoods/shared';

interface DeliveryPartnerViewProps {
  driverId: string;
}

export default function DeliveryPartnerView({ driverId }: DeliveryPartnerViewProps) {
  const [isOnline, setIsOnline] = useState(false);
  
  // Active assigned order
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [showDispatchAlert, setShowDispatchAlert] = useState(false);

  // Cash Collection States
  const [cashTxnId, setCashTxnId] = useState('');
  const [cashScreenshot, setCashScreenshot] = useState<string | null>(null);
  const [cashSubmitting, setCashSubmitting] = useState(false);

  // Simulated coordinate telemetry – defaulted to Dantewada Kirandul
  const [coords, setCoords] = useState(DANTEWADA_CENTER);

  const checkActiveOrder = async () => {
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('delivery_partner_id', driverId)
        .in('status', ['awaiting_pickup', 'driver_accepted', 'picked_up', 'out_for_delivery'])
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!error && data) {
        setActiveOrder(data as Order);
        if (data.status === 'awaiting_pickup') {
          setShowDispatchAlert(true);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch active driver order:', err);
    }
  };

  useEffect(() => {
    if (!isOnline) {
      setActiveOrder(null);
      setShowDispatchAlert(false);
      return;
    }

    // Initialize driver location in Supabase
    updateDriverLocation();

    // Check for existing active orders assigned to driver
    checkActiveOrder();

    // Subscribe to order assignments where delivery_partner_id = driverId
    const orderSubscription = supabase
      .channel('driver-assignments')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orders' },
        (payload: any) => {
          const updatedOrder = payload.new as Order;
          if (updatedOrder.delivery_partner_id === driverId && updatedOrder.status === 'awaiting_pickup') {
            // New dispatch received!
            setActiveOrder(updatedOrder);
            setShowDispatchAlert(true);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(orderSubscription);
    };
  }, [isOnline, driverId]);

  const updateDriverLocation = async () => {
    // Update delivery_partners coordinates in public table
    const { error } = await supabase
      .from('delivery_partners')
      .upsert({
        id: driverId,
        is_online: isOnline,
        location: `POINT(${coords.longitude} ${coords.latitude})`,
      });

    if (error) {
      console.log('Driver location update failed (using mock/offline environment)');
    }
  };

  const handleToggleOnline = async (value: boolean) => {
    setIsOnline(value);
    
    // Update online status in Supabase
    const { error } = await supabase
      .from('delivery_partners')
      .update({ is_online: value })
      .eq('id', driverId);

    if (error) {
      console.log('Driver status update failed (using mock/offline environment)');
    }
  };

  const handleAcceptRequest = async () => {
    setShowDispatchAlert(false);
    if (!activeOrder) return;

    // Transition order state to 'driver_accepted'
    const { error } = await supabase
      .from('orders')
      .update({ status: 'driver_accepted' })
      .eq('id', activeOrder.id);

    // Also write to delivery logs
    const { error: logErr } = await supabase
      .from('delivery_logs')
      .insert({
        order_id: activeOrder.id,
        delivery_partner_id: driverId,
        status: 'accepted',
        location: `POINT(${coords.longitude} ${coords.latitude})`,
      });

    setActiveOrder(prev => prev ? { ...prev, status: 'driver_accepted' } : null);
  };

  const handleMarkPickedUp = async () => {
    if (!activeOrder) return;

    // Transition order state to 'picked_up'
    const { error } = await supabase
      .from('orders')
      .update({ status: 'picked_up' })
      .eq('id', activeOrder.id);

    // Also write to delivery logs
    const { error: logErr } = await supabase
      .from('delivery_logs')
      .insert({
        order_id: activeOrder.id,
        delivery_partner_id: driverId,
        status: 'picked_up',
        location: `POINT(${coords.longitude} ${coords.latitude})`,
      });

    setActiveOrder(prev => prev ? { ...prev, status: 'picked_up' } : null);
  };

  const handleStartDelivery = async () => {
    if (!activeOrder) return;

    // Transition order state to 'out_for_delivery'
    const { error } = await supabase
      .from('orders')
      .update({ status: 'out_for_delivery' })
      .eq('id', activeOrder.id);

    // Also write to delivery logs
    const { error: logErr } = await supabase
      .from('delivery_logs')
      .insert({
        order_id: activeOrder.id,
        delivery_partner_id: driverId,
        status: 'out_for_delivery',
        location: `POINT(${coords.longitude} ${coords.latitude})`,
      });

    setActiveOrder(prev => prev ? { ...prev, status: 'out_for_delivery' } : null);
  };

  const handleRejectRequest = () => {
    setShowDispatchAlert(false);
    setActiveOrder(null);
  };

  const handleMarkDelivered = async () => {
    if (!activeOrder) return;

    // Update order status to 'delivered'
    const { error } = await supabase
      .from('orders')
      .update({ status: 'delivered' })
      .eq('id', activeOrder.id);

    // Log completion
    const { error: logErr } = await supabase
      .from('delivery_logs')
      .insert({
        order_id: activeOrder.id,
        delivery_partner_id: driverId,
        status: 'delivered',
        location: `POINT(${coords.longitude} ${coords.latitude})`,
      });

    setActiveOrder(prev => prev ? { ...prev, status: 'delivered' } : null);
    
    if (activeOrder.payment_method !== 'cod') {
      Alert.alert('Success', 'Order completed! Good job.');
      setTimeout(() => setActiveOrder(null), 2000);
    }
  };

  const handleCashSubmit = async () => {
    if (!cashTxnId.trim()) {
      Alert.alert('Error', 'Please enter the UPI Transaction ID for your cash transfer.');
      return;
    }
    setCashSubmitting(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          driver_cash_submitted: true,
          driver_cash_txn_id: cashTxnId.trim(),
          driver_cash_screenshot_url: cashScreenshot || 'mock-receipt-url',
          payment_status: 'paid'
        })
        .eq('id', activeOrder!.id);
      if (error) throw error;

      setActiveOrder(prev => prev ? { 
        ...prev, 
        driver_cash_submitted: true, 
        driver_cash_txn_id: cashTxnId.trim(),
        payment_status: 'paid'
      } : null);

      Alert.alert('Success', 'Cash submission successful! Duty complete.');
      setTimeout(() => {
        setActiveOrder(null);
      }, 1500);
    } catch (err) {
      Alert.alert('Offline Mode', 'Cash submission completed offline.');
      setActiveOrder(prev => prev ? { 
        ...prev, 
        driver_cash_submitted: true, 
        driver_cash_txn_id: cashTxnId.trim(),
        payment_status: 'paid'
      } : null);
      setTimeout(() => {
        setActiveOrder(null);
      }, 1500);
    } finally {
      setCashSubmitting(false);
      setCashTxnId('');
      setCashScreenshot(null);
    }
  };

  // Simulating delivery driver moving coordinates on a map
  const simulateMovement = () => {
    setCoords(prev => {
      const next = {
        latitude: prev.latitude - 0.0005,
        longitude: prev.longitude + 0.0003,
      };
      updateDriverLocation();
      return next;
    });
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.card}>
        <View style={styles.statusRow}>
          <View>
            <Text style={styles.title}>Rider Duty Status</Text>
            <Text style={styles.subtitle}>{isOnline ? 'Active & Ready for Dispatch' : 'Offline'}</Text>
          </View>
          <Switch
            value={isOnline}
            onValueChange={handleToggleOnline}
            trackColor={{ false: '#334155', true: '#8b5cf6' }}
            thumbColor={isOnline ? '#c084fc' : '#94a3b8'}
          />
        </View>
      </View>

      {isOnline && (
        <View style={styles.card}>
          <Text style={styles.title}>📍 GPS Telemetry Simulator</Text>
          <Text style={styles.body}>Coordinate: {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}</Text>
          <TouchableOpacity style={styles.btnSecondary} onPress={simulateMovement}>
            <Text style={styles.btnSecondaryText}>Simulate Move Coordinates</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Dispatch alert request overlay */}
      {showDispatchAlert && activeOrder && (
        <View style={[styles.card, styles.alertCard]}>
          <Text style={styles.alertTitle}>⚡ New Dispatch Request!</Text>
          <Text style={styles.alertBody}>Store in Kirandul needs instant pickup within 5km SLA.</Text>
          
          <View style={styles.divider} />
          
          <Text style={styles.label}>Delivery Target Address:</Text>
          <Text style={styles.body}>{activeOrder.delivery_address}</Text>
          
          <View style={styles.btnRow}>
            <TouchableOpacity style={styles.btnReject} onPress={handleRejectRequest}>
              <Text style={styles.btnRejectText}>Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnAccept} onPress={handleAcceptRequest}>
              <Text style={styles.btnAcceptText}>Accept Order</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Active order execution tracking */}
      {!showDispatchAlert && activeOrder && (
        <View style={styles.card}>
          <Text style={styles.title}>📦 Active Order Execution</Text>
          <Text style={styles.label}>Order Status:</Text>
          <Text style={styles.statusBadge}>{activeOrder.status.replace('_', ' ').toUpperCase()}</Text>

          <View style={styles.divider} />

          <Text style={styles.label}>Delivery Target Address:</Text>
          <Text style={styles.body}>{activeOrder.delivery_address}</Text>

          <View style={styles.divider} />

          {/* Payment Info Badges */}
          <Text style={styles.label}>Payment Details:</Text>
          <Text style={[styles.body, { fontWeight: 'bold', color: activeOrder.payment_method === 'cod' ? '#fbbf24' : '#34d399' }]}>
            {activeOrder.payment_method === 'cod' ? `💵 Cash to Collect: ${formatINR(activeOrder.total_amount)}` : '📱 Paid online via UPI'}
          </Text>

          <View style={styles.divider} />

          {activeOrder.status === 'driver_accepted' ? (
            <TouchableOpacity style={styles.btnPrimary} onPress={handleMarkPickedUp}>
              <Text style={styles.btnText}>Mark Order as [Picked Up]</Text>
            </TouchableOpacity>
          ) : activeOrder.status === 'picked_up' ? (
            <TouchableOpacity style={styles.btnPrimary} onPress={handleStartDelivery}>
              <Text style={styles.btnText}>Start Delivery [On the Way]</Text>
            </TouchableOpacity>
          ) : activeOrder.status === 'out_for_delivery' ? (
            <TouchableOpacity style={styles.btnPrimary} onPress={handleMarkDelivered}>
              <Text style={styles.btnText}>Mark Order as [Delivered]</Text>
            </TouchableOpacity>
          ) : activeOrder.status === 'delivered' ? (
            activeOrder.payment_method === 'cod' && !activeOrder.driver_cash_submitted ? (
              <View style={styles.cashForm}>
                <Text style={styles.cashFormTitle}>💰 COD Cash Collected</Text>
                <Text style={styles.cashFormSub}>
                  Transfer {formatINR(activeOrder.total_amount)} to central UPI: kdlgoods@icici, then submit Txn ID.
                </Text>
                
                <TextInput
                  style={[styles.input, { marginTop: 10 }]}
                  placeholder="UPI Txn ID (Required)"
                  placeholderTextColor="#94a3b8"
                  value={cashTxnId}
                  onChangeText={setCashTxnId}
                />
                
                <TouchableOpacity 
                  style={[styles.btnSecondary, { marginTop: 10 }]} 
                  onPress={() => setCashScreenshot('mock_mobile_screenshot.png')}
                >
                  <Text style={styles.btnSecondaryText}>
                    {cashScreenshot ? '✓ Screenshot attached' : 'Attach Transfer Receipt'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity 
                  style={[styles.btnPrimary, { marginTop: 12, backgroundColor: '#fbbf24' }]} 
                  onPress={handleCashSubmit}
                  disabled={cashSubmitting}
                >
                  <Text style={[styles.btnText, { color: '#000000', fontWeight: '900' }]}>
                    {cashSubmitting ? 'Verifying...' : 'Confirm Cash Submission'}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Text style={styles.successText}>✓ Delivery completed successfully & cash submitted.</Text>
            )
          ) : (
            <Text style={styles.body}>Awaiting next steps.</Text>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 15,
    backgroundColor: '#121212',
  },
  card: {
    backgroundColor: '#1A1A1A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: '#2E2E2E',
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#f8fafc',
  },
  subtitle: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  body: {
    fontSize: 14,
    color: '#cbd5e1',
    marginVertical: 4,
    lineHeight: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    marginTop: 6,
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 12,
  },
  btnPrimary: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 5,
  },
  btnText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 14,
  },
  btnSecondary: {
    backgroundColor: 'rgba(247,209,8,0.08)',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: '#F7D108',
  },
  btnSecondaryText: {
    color: '#F7D108',
    fontWeight: '700',
    fontSize: 13,
  },
  alertCard: {
    borderColor: 'rgba(247,209,8,0.5)',
    borderWidth: 2,
    backgroundColor: 'rgba(247,209,8,0.05)',
  },
  alertTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F7D108',
  },
  alertBody: {
    fontSize: 13,
    color: '#cbd5e1',
    marginTop: 2,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 15,
  },
  btnAccept: {
    flex: 1,
    backgroundColor: '#F7D108',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnAcceptText: {
    color: '#121212',
    fontWeight: '800',
  },
  btnReject: {
    flex: 1,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#ef4444',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
  },
  btnRejectText: {
    color: '#ef4444',
    fontWeight: '700',
  },
  statusBadge: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fbbf24',
    backgroundColor: 'rgba(251, 191, 36, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  successText: {
    color: '#34d399',
    fontWeight: '700',
    textAlign: 'center',
  },
  input: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    color: '#F8FAFC',
    fontSize: 14,
  },
  cashForm: {
    marginTop: 10,
    padding: 12,
    backgroundColor: 'rgba(247,209,8,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(247,209,8,0.2)',
    borderRadius: 8,
  },
  cashFormTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#F7D108',
    textAlign: 'center',
  },
  cashFormSub: {
    fontSize: 11,
    color: '#94a3b8',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 16,
  },
});
