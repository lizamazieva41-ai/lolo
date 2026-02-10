import axios from 'axios';

interface WingPayConfig {
  apiKey: string;
  baseUrl: string;
  merchantId?: string;
}

interface PaymentRequest {
  amount: number;
  currency: string;
  description: string;
  customerPhone?: string;
  callbackUrl?: string;
}

interface CardPaymentRequest extends PaymentRequest {
  cardNumber: string;
  expiryMonth: string;
  expiryYear: string;
  cvv: string;
  cardHolderName: string;
  billingAddress?: {
    street: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
}

interface PaymentResponse {
  success: boolean;
  transactionId?: string;
  paymentUrl?: string;
  error?: string;
}

interface PaymentStatusResponse {
  transactionId: string;
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  amount: number;
  currency: string;
}

class WingPayService {
  private config: WingPayConfig;

  constructor() {
    this.config = {
      apiKey: process.env.WINGPAY_API_KEY || '',
      baseUrl: process.env.WINGPAY_BASE_URL || 'https://api.wingpay.com',
      merchantId: process.env.WINGPAY_MERCHANT_ID || ''
    };
  }

  async initiatePayment(request: PaymentRequest): Promise<PaymentResponse> {
    try {
      // For mobile wallet payments (existing functionality)
      const payload = {
        merchant_id: this.config.merchantId,
        amount: request.amount,
        currency: request.currency || 'USD',
        description: request.description,
        customer_phone: request.customerPhone,
        callback_url: request.callbackUrl,
        timestamp: new Date().toISOString()
      };

      const signature = this.generateSignature(payload);

      const response: any = await axios.post(
        `${this.config.baseUrl}/api/v1/payments/initiate`,
        {
          ...payload,
          signature
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      if (response.data.success) {
        return {
          success: true,
          transactionId: response.data.transaction_id,
          paymentUrl: response.data.payment_url
        };
      } else {
        return {
          success: false,
          error: response.data.message || 'Payment initiation failed'
        };
      }
    } catch (error: any) {
      console.error('WingPay payment initiation error:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Payment service error'
      };
    }
  }

  async initiateCardPayment(request: CardPaymentRequest): Promise<PaymentResponse> {
    try {
      // For debit/credit card payments (new functionality)
      const payload = {
        merchant_id: this.config.merchantId,
        amount: request.amount,
        currency: request.currency || 'USD',
        description: request.description,
        customer_phone: request.customerPhone,
        callback_url: request.callbackUrl,
        payment_method: 'card',
        card_details: {
          number: request.cardNumber.replace(/\s/g, ''), // Remove spaces
          expiry_month: request.expiryMonth,
          expiry_year: request.expiryYear,
          cvv: request.cvv,
          holder_name: request.cardHolderName,
          billing_address: request.billingAddress
        },
        timestamp: new Date().toISOString()
      };

      const signature = this.generateSignature(payload);

      const response: any = await axios.post(
        `${this.config.baseUrl}/api/v1/payments/card/initiate`,
        {
          ...payload,
          signature
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      if (response.data.success) {
        return {
          success: true,
          transactionId: response.data.transaction_id,
          paymentUrl: response.data.payment_url // May redirect to 3D Secure
        };
      } else {
        return {
          success: false,
          error: response.data.message || 'Card payment initiation failed'
        };
      }
    } catch (error: any) {
      console.error('WingPay card payment initiation error:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Card payment service error'
      };
    }
  }

  async checkPaymentStatus(transactionId: string): Promise<PaymentStatusResponse | null> {
    try {
      const payload = {
        transaction_id: transactionId,
        timestamp: new Date().toISOString()
      };

      const signature = this.generateSignature(payload);

      const response: any = await axios.post(
        `${this.config.baseUrl}/api/v1/payments/status`,
        {
          ...payload,
          signature
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 10000
        }
      );

      return {
        transactionId,
        status: response.data.status,
        amount: response.data.amount,
        currency: response.data.currency
      };
    } catch (error: any) {
      console.error('WingPay status check error:', error);
      return null;
    }
  }

  async refundPayment(transactionId: string, amount?: number): Promise<boolean> {
    try {
      const payload = {
        transaction_id: transactionId,
        amount,
        timestamp: new Date().toISOString()
      };

      const signature = this.generateSignature(payload);

      const response: any = await axios.post(
        `${this.config.baseUrl}/api/v1/payments/refund`,
        {
          ...payload,
          signature
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.apiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000
        }
      );

      return response.data.success === true;
    } catch (error: any) {
      console.error('WingPay refund error:', error);
      return false;
    }
  }

  // Validate card details before processing
  validateCardDetails(cardNumber: string, expiryMonth: string, expiryYear: string, cvv: string): { valid: boolean; error?: string } {
    // Basic validation
    const cleanCardNumber = cardNumber.replace(/\s/g, '');

    // Check card number format (basic Luhn algorithm check would be better)
    if (!/^\d{13,19}$/.test(cleanCardNumber)) {
      return { valid: false, error: 'Invalid card number format' };
    }

    // Check expiry date
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;
    const expYear = parseInt(expiryYear);
    const expMonth = parseInt(expiryMonth);

    if (expYear < currentYear || (expYear === currentYear && expMonth < currentMonth)) {
      return { valid: false, error: 'Card has expired' };
    }

    // Check CVV
    if (!/^\d{3,4}$/.test(cvv)) {
      return { valid: false, error: 'Invalid CVV' };
    }

    return { valid: true };
  }

  private generateSignature(payload: any): string {
    // In real implementation, use HMAC-SHA256 with secret key
    // For now, simplified signature
    const dataString = JSON.stringify(payload) + this.config.apiKey;
    return require('crypto').createHash('sha256').update(dataString).digest('hex');
  }
}

// Export singleton instance
export default new WingPayService();
