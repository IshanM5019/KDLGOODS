import { z } from 'zod';

export const LatLngSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const SignUpSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
  full_name: z.string().min(2, 'Name must be at least 2 characters long'),
  role: z.enum(['customer', 'seller', 'delivery']),
  phone_number: z.string()
    .min(10, 'Mobile number must be at least 10 digits')
    .regex(/^\+?[0-9]+$/, 'Mobile number must contain only digits'),
});

export const SignInSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

export const OnboardSellerSchema = z.object({
  store_name: z.string().min(2, 'Store name must be at least 2 characters long'),
  description: z.string().max(500, 'Description can be at most 500 characters').optional().nullable(),
  address: z.string().min(5, 'Address must be at least 5 characters long'),
  location: LatLngSchema,
  banner_url: z.string().url('Invalid banner URL').optional().nullable(),
});

export const CreateProductSchema = z.object({
  name: z.string().min(2, 'Product name must be at least 2 characters long'),
  description: z.string().max(500, 'Description can be at most 500 characters').optional().nullable(),
  price: z.number().positive('Price must be greater than zero'),
  image_url: z.string().url('Invalid image URL').optional().nullable(),
  category: z.string().min(2, 'Category must be at least 2 characters long'),
  is_available: z.boolean().default(true),
  is_ready_for_30min: z.boolean().default(true),
});

export const UpdateProductSchema = CreateProductSchema.partial();

export const AddToCartSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
  quantity: z.number().int().positive('Quantity must be at least 1'),
});

export const UpdateCartItemSchema = z.object({
  quantity: z.number().int().positive('Quantity must be at least 1'),
});

export const CheckoutSchema = z.object({
  delivery_address: z.string().min(5, 'Delivery address must be at least 5 characters long'),
  delivery_location: LatLngSchema,
});

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(['placed', 'accepted', 'preparing', 'awaiting_pickup', 'driver_accepted', 'picked_up', 'out_for_delivery', 'delivered', 'cancelled']),
});

export const UpdateDeliveryLogSchema = z.object({
  status: z.string().min(1, 'Status description required'),
  location: LatLngSchema.optional().nullable(),
});
