export type UserRole = 'customer' | 'seller' | 'delivery' | 'admin';

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface UserProfile {
  id: string;
  role: UserRole;
  full_name: string;
  phone_number: string | null;
  avatar_url: string | null;
  address?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SellerProfile {
  id: string;
  store_name: string;
  description: string | null;
  address: string;
  location: LatLng;
  geohash: string;
  is_active: boolean;
  banner_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeliveryPartner {
  id: string;
  is_online: boolean;
  location: LatLng | null;
  geohash: string | null;
  updated_at: string;
}

export interface Product {
  id: string;
  seller_id: string;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  category: string;
  is_available: boolean;
  is_ready_for_30min: boolean;
  created_at: string;
  updated_at: string;
}

export interface Cart {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface CartItem {
  id: string;
  cart_id: string;
  product_id: string;
  quantity: number;
  created_at: string;
  product?: Product;
}

export type OrderStatus = 'placed' | 'accepted' | 'preparing' | 'awaiting_pickup' | 'driver_accepted' | 'picked_up' | 'out_for_delivery' | 'delivered' | 'cancelled';

export interface Order {
  id: string;
  customer_id: string;
  seller_id: string;
  delivery_partner_id: string | null;
  status: OrderStatus;
  total_amount: number;
  delivery_partner_fee: number;
  items_total: number;
  handling_charge: number;
  small_cart_fee: number;
  delivery_address: string;
  delivery_location: LatLng;
  created_at: string;
  updated_at: string;
  payment_method: 'cod' | 'upi';
  payment_status: 'pending' | 'paid';
  upi_transaction_id?: string | null;
  upi_screenshot_url?: string | null;
  driver_cash_submitted: boolean;
  driver_cash_txn_id?: string | null;
  driver_cash_screenshot_url?: string | null;
  items?: OrderItem[];
  customer?: UserProfile;
  seller?: SellerProfile;
  delivery_partner?: UserProfile;
  driver?: UserProfile;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price_at_order: number;
  product?: Product;
}

export interface DeliveryLog {
  id: string;
  order_id: string;
  delivery_partner_id: string | null;
  status: string;
  location: LatLng | null;
  timestamp: string;
}
