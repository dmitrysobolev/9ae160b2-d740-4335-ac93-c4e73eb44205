import axios, { type AxiosInstance, AxiosError } from 'axios';
import pRetry from 'p-retry';

export interface APIResponse {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;
}

export type SoloonColor = 'blue' | 'red' | 'purple' | 'white';
export type ComethDirection = 'up' | 'down' | 'left' | 'right';

export interface BaseEntity {
  row: number;
  column: number;
}

export interface PolyanetEntity extends BaseEntity {}

export interface SoloonEntity extends BaseEntity {
  color: SoloonColor;
}

export interface ComethEntity extends BaseEntity {
  direction: ComethDirection;
}

class MegaverseAPI {
  private readonly BASE_URL = 'https://challenge.crossmint.io/api';
  private readonly client: AxiosInstance;
  private readonly candidateId: string;

  constructor(candidateId: string) {
    this.candidateId = candidateId;
    this.client = axios.create({
      baseURL: this.BASE_URL,
      headers: { 'Content-Type': 'application/json' },
      timeout: 10000,
    });
  }

  private shouldRetry(error: unknown): boolean {
    if (error instanceof AxiosError) {
      // Retry on network errors, timeouts, or 5xx/429 status codes
      if (!error.response) return true; // Network error
      const status = error.response.status;
      return status >= 500 || status === 429; // Server errors or rate limiting
    }
    return true; // Retry on other errors
  }

  private handleError(error: unknown, context: string): APIResponse {
    if (error instanceof AxiosError) {
      if (error.response) {
        const message = error.response.data?.message || error.response.statusText;
        return {
          success: false,
          message: `${context} failed: ${message}`,
        };
      }
      if (error.request) {
        return {
          success: false,
          message: `${context} failed: Unable to connect to the API after retries`,
        };
      }
    }
    return {
      success: false,
      message: `${context} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }

  private async withRetry<T extends { data?: Record<string, unknown> }>(
    operation: () => Promise<T>,
    context: string
  ): Promise<APIResponse> {
    try {
      const response = await pRetry(operation, {
        retries: 3,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 8000,
        shouldRetry: (error) => this.shouldRetry(error),
        onFailedAttempt: (error) => {
          console.log(`${context} attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`);
        },
      });

      return {
        success: true,
        message: 'Request successful',
        data: response.data,
      };
    } catch (error) {
      return this.handleError(error, context);
    }
  }

  private async makeRequest<T extends BaseEntity>(
    method: 'POST' | 'DELETE',
    endpoint: string,
    payload: T
  ): Promise<APIResponse> {
    return this.withRetry(
      () => this.client.request({
        method,
        url: `/${endpoint}`,
        data: { ...payload, candidateId: this.candidateId },
      }),
      `${method} ${endpoint}`
    );
  }

  public async createPolyanet(payload: PolyanetEntity): Promise<APIResponse> {
    return this.makeRequest('POST', 'polyanets', payload);
  }

  public async deletePolyanet(payload: PolyanetEntity): Promise<APIResponse> {
    return this.makeRequest('DELETE', 'polyanets', payload);
  }

  public async createSoloon(payload: SoloonEntity): Promise<APIResponse> {
    return this.makeRequest('POST', 'soloons', payload);
  }

  public async deleteSoloon(payload: PolyanetEntity): Promise<APIResponse> {
    return this.makeRequest('DELETE', 'soloons', payload);
  }

  public async createCometh(payload: ComethEntity): Promise<APIResponse> {
    return this.makeRequest('POST', 'comeths', payload);
  }

  public async deleteCometh(payload: PolyanetEntity): Promise<APIResponse> {
    return this.makeRequest('DELETE', 'comeths', payload);
  }

  public async getGoalMap(): Promise<APIResponse> {
    const response = await this.withRetry(
      () => this.client.get(`/map/${this.candidateId}/goal`),
      'getGoalMap'
    );
    
    if (response.success) {
      response.message = 'Goal map retrieved successfully';
    }
    
    return response;
  }

  public async validateMap(): Promise<APIResponse> {
    const response = await this.withRetry(
      () => this.client.post(`/map/${this.candidateId}/validate`, { candidateId: this.candidateId }),
      'validateMap'
    );
    
    if (response.success) {
      response.message = 'Map validation successful';
    }
    
    return response;
  }
}

export default MegaverseAPI;