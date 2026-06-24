import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Switch, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { supabase } from '../lib/supabase';
import { Order, OrderStatus, DANTEWADA_CENTER, TOWN_NAME, formatINR } from '@kdlgoods/shared';

export default function DeliveryPartnerView() {
  const [isOnline, setIsOnline] = useState(false);
  const [driverId, setDriverId] = useState('driver-uuid-placeholder-123');
  
  // Active assigned order
  const [activeOrder, setActiveOrder] = useState<Order | null>(null);
  const [showDispatchAlert, setShowDispatchAlert] = useState(false);

  // Simulated coordinate telemetry – defaulted to Dantewada Kirandul
  const [coords, setCoords] = useState(DANTEWADA_CENTER);

  useEffect(() => {
    if (!isOnline) {
      setActiveOrder(null);
      setShowDispatchAlert(false);
      return;
    }

    // Initialize driver location in Supabase
    updateDriverLocation();

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

    // No auto-dispatch simulator – clean empty state until real Supabase order arrives

    return () => {
      supabase.removeChannel(orderSubscription);
    };
  }, [isOnline]);

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
        status: 'picked_up',
        location: `POINT(${coords.longitude} ${coords.latitude})`,
      });

    if (error || logErr) {
      // Mock transition locally
      setActiveOrder(prev => prev ? { ...prev, status: 'out_for_delivery' } : null);
    } else {
      setActiveOrder(prev => prev ? { ...prev, status: 'out_for_delivery' } : null);
    }
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

    if (error || logErr) {
      setActiveOrder(prev => prev ? { ...prev, status: 'delivered' } : null);
      Alert.alert('Success', 'Order completed! Good job.');
      setTimeout(() => setActiveOrder(null), 2000);
    } else {
      setActiveOrder(prev => prev ? { ...prev, status: 'delivered' } : null);
      Alert.alert('Success', 'Order completed! Good job.');
      setTimeout(() => setActiveOrder(null), 2000);
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

          {activeOrder.status === 'out_for_delivery' ? (
            <TouchableOpacity style={styles.btnPrimary} onPress={handleMarkDelivered}>
              <Text style={styles.btnText}>Mark Order as [Delivered]</Text>
            </TouchableOpacity>
          ) : activeOrder.status === 'delivered' ? (
            <Text style={styles.successText}>✓ Delivery completed successfully.</Text>
          ) : (
            <Text style={styles.body}>Order is prepared. Reach store for pickup.</Text>
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
});
