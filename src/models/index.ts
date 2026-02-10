// Database Models/Interfaces

export interface User {
  id: number;
  email: string;
  password_hash: string;
  phone?: string;
  created_at: Date;
  updated_at?: Date;
}

export interface Plan {
  id: number;
  name: string;
  data_limit: string; // e.g., "10GB", "Unlimited"
  validity_days: number;
  price_usd: number;
  price_khr: number;
  active: boolean;
  created_at: Date;
}

export interface Transaction {
  id: number;
  user_id: number;
  plan_id: number;
  transaction_id: string; // UUID or generated ID
  amount_usd: number;
  payment_method: string;
  payment_reference?: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  created_at: Date;
  updated_at?: Date;
}

export interface ESIMProfile {
  id: number;
  user_id: number;
  transaction_id: number;
  iccid: string;
  imsi: string;
  status: 'pending' | 'activated' | 'suspended' | 'terminated';
  activated_at?: Date;
  created_at: Date;
  updated_at?: Date;
}

export interface Webhook {
  id: number;
  event_type: string; // e.g., 'esim_activated', 'payment_completed'
  payload: object;
  processed: boolean;
  processed_at?: Date;
  created_at: Date;
}

// Request/Response interfaces for API
export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  email: string;
  password: string;
  phone?: string;
}

export interface PurchaseRequest {
  planId: number;
  paymentMethod: string;
  paymentInfo: any;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: number;
    email: string;
  };
}

export interface ESIMActivationResponse {
  lpaCode: string;
  qrCodeUrl: string;
  esimProfile: {
    iccid: string;
    imsi: string;
    status: string;
  };
}
