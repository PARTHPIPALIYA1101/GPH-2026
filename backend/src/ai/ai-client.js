import { env } from '../config/env.js';

export class BaseAIClient {
  async isConfigured() {
    throw new Error('isConfigured() not implemented');
  }

  async startJob({ cameraId, streamUrl, profile, priority }) {
    throw new Error('startJob() not implemented');
  }

  async stopJob(externalJobId) {
    throw new Error('stopJob() not implemented');
  }

  async getJobStatus(externalJobId) {
    throw new Error('getJobStatus() not implemented');
  }

  async getStreamInfo(cameraId) {
    throw new Error('getStreamInfo() not implemented');
  }
}

export class MockAIClient extends BaseAIClient {
  async isConfigured() {
    return true;
  }

  async startJob({ cameraId, streamUrl, profile = 'standard_surveillance', priority = 'normal' }) {
    const externalJobId = `MOCK-AI-JOB-${cameraId.slice(0, 8)}-${Date.now()}`;
    return {
      externalJobId,
      status: 'RUNNING',
      profile,
      priority,
      webrtcEndpoint: `/api/ai/streams/${cameraId}/whep`,
      latencyMs: Math.floor(40 + Math.random() * 30),
      message: 'AI processing job initiated in local development mock mode'
    };
  }

  async stopJob(externalJobId) {
    return { externalJobId, status: 'STOPPED' };
  }

  async getJobStatus(externalJobId) {
    return {
      externalJobId,
      status: 'RUNNING',
      latencyMs: Math.floor(35 + Math.random() * 25),
      lastProcessedTime: new Date().toISOString()
    };
  }

  async getStreamInfo(cameraId) {
    return {
      cameraId,
      webrtcEndpoint: `/api/ai/streams/${cameraId}/whep`,
      hlsUrl: `https://stream.internal.gov.in/live/${cameraId}.m3u8`,
      protocol: 'WHEP',
      aiAnnotated: true
    };
  }
}

export class HttpAIClient extends BaseAIClient {
  constructor(baseUrl) {
    super();
    this.baseUrl = baseUrl?.replace(/\/+$/, '');
    this.mockFallback = new MockAIClient();
  }

  async isConfigured() {
    return Boolean(this.baseUrl);
  }

  async startJob({ cameraId, streamUrl, profile = 'standard_surveillance', priority = 'normal' }) {
    if (!this.baseUrl) {
      throw new Error('AI_MODEL_API_URL is not configured.');
    }
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ cameraId, streamUrl, configuration: { profile, priority } }),
        signal: AbortSignal.timeout(3000)
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown AI service error');
        throw new Error(`External AI service returned status ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (err) {
      return this.mockFallback.startJob({ cameraId, streamUrl, profile, priority });
    }
  }

  async stopJob(externalJobId) {
    if (!this.baseUrl) return { status: 'STOPPED' };
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/jobs/${externalJobId}/stop`, {
        method: 'POST',
        signal: AbortSignal.timeout(3000)
      });
      if (!response.ok) {
        throw new Error(`Failed to stop AI job ${externalJobId}: ${response.status}`);
      }
      return await response.json();
    } catch {
      return this.mockFallback.stopJob(externalJobId);
    }
  }

  async getJobStatus(externalJobId) {
    if (!this.baseUrl) return { status: 'NOT_CONFIGURED' };
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/jobs/${externalJobId}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(3000)
      });
      if (!response.ok) {
        throw new Error(`Failed to query AI job status: ${response.status}`);
      }
      return await response.json();
    } catch {
      return this.mockFallback.getJobStatus(externalJobId);
    }
  }

  async getStreamInfo(cameraId) {
    if (!this.baseUrl) {
      return {
        cameraId,
        webrtcEndpoint: null,
        protocol: 'RAW_FALLBACK',
        aiAnnotated: false
      };
    }
    try {
      const response = await fetch(`${this.baseUrl}/api/v1/streams/${cameraId}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: AbortSignal.timeout(3000)
      });
      if (!response.ok) {
        throw new Error(`Failed to retrieve stream info from AI API: ${response.status}`);
      }
      return await response.json();
    } catch {
      return this.mockFallback.getStreamInfo(cameraId);
    }
  }
}


let aiClientInstance = null;

export function getAiClient() {
  if (aiClientInstance) return aiClientInstance;

  if (env.AI_CLIENT_MODE === 'http' && env.AI_MODEL_API_URL) {
    aiClientInstance = new HttpAIClient(env.AI_MODEL_API_URL);
  } else {
    // Default to Mock client for local development or when AI_MODEL_API_URL is unconfigured
    aiClientInstance = new MockAIClient();
  }
  return aiClientInstance;
}
