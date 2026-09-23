import { API_BASE } from './apiConfig';

/**
 * Helper to get active credentials from localStorage
 */
export function getStoredAuth() {
  const token = localStorage.getItem('nmc_token');
  const role = localStorage.getItem('nmc_role'); // 'admin' | 'reviewer' | null
  const reviewerKey = localStorage.getItem('nmc_reviewer_key') || '';
  return { token, role, reviewerKey };
}

export function setStoredAuth(token: string, role: string, reviewerKey?: string) {
  localStorage.setItem('nmc_token', token);
  localStorage.setItem('nmc_role', role);
  if (reviewerKey) {
    localStorage.setItem('nmc_reviewer_key', reviewerKey);
  }
}

export function clearStoredAuth() {
  localStorage.removeItem('nmc_token');
  localStorage.removeItem('nmc_role');
  localStorage.removeItem('nmc_reviewer_key');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const { token, reviewerKey } = getStoredAuth();

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  if (reviewerKey) {
    headers['X-Reviewer-Key'] = reviewerKey;
  }

  // Set json content-type if body is object and not FormData
  if (options.body && !(options.body instanceof FormData) && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errMsg = `Request failed: ${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      errMsg = errJson.detail?.message || errJson.detail || errJson.message || errMsg;
      if (typeof errMsg !== 'string') {
        errMsg = JSON.stringify(errMsg);
      }
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }

  return response.json();
}

export const nmcApi = {
  // Authentication
  auth: {
    adminLogin: (password: string) =>
      request<{ role: string; token: string; message: string }>('/api/nmc/auth/admin-login', {
        method: 'POST',
        body: JSON.stringify({ password }),
      }),
    reviewerLogin: (reviewer_key: string) =>
      request<{ role: string; token: string; message: string }>('/api/nmc/auth/reviewer-login', {
        method: 'POST',
        body: JSON.stringify({ reviewer_key }),
      }),
    verifyToken: (token: string) =>
      request<{ valid: boolean; role: string }>(`/api/nmc/auth/verify?token=${encodeURIComponent(token)}`),
  },

  // CPSE & Dataset Management
  cpses: {
    list: () => request<any[]>('/api/nmc/cpses'),
    create: (data: { name: string; code: string; description?: string }) =>
      request<any>('/api/nmc/cpses', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    uploadDataset: (cpseId: string, file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      return request<{ status: string; dataset_id: string; record_count: number; message: string }>(
        `/api/nmc/cpses/${cpseId}/upload`,
        {
          method: 'POST',
          body: fd,
        }
      );
    },
    normalizeDataset: (cpseId: string) =>
      request<{ status: string; dataset_id: string; message: string }>(
        `/api/nmc/cpses/${cpseId}/normalize`,
        { method: 'POST' }
      ),
    getDatasetStatus: (cpseId: string) =>
      request<any>(`/api/nmc/cpses/${cpseId}/dataset`),
    delete: (cpseId: string) =>
      request<{ status: string; message: string }>(`/api/nmc/cpses/${cpseId}`, {
        method: 'DELETE',
      }),
  },

  // Materials Explorer
  materials: {
    list: (params: {
      cpse_id?: string;
      search?: string;
      processing_status?: string;
      mapping_status?: string;
      page?: number;
      page_size?: number;
    }) => {
      const sp = new URLSearchParams();
      if (params.cpse_id) sp.set('cpse_id', params.cpse_id);
      if (params.search) sp.set('search', params.search);
      if (params.processing_status) sp.set('processing_status', params.processing_status);
      if (params.mapping_status) sp.set('mapping_status', params.mapping_status);
      if (params.page) sp.set('page', params.page.toString());
      if (params.page_size) sp.set('page_size', params.page_size.toString());
      return request<{
        items: any[];
        total: number;
        page: number;
        page_size: number;
        total_pages: number;
      }>(`/api/nmc/materials?${sp.toString()}`);
    },
    get: (id: string) => request<any>(`/api/nmc/materials/${id}`),
  },

  // Cross-CPSE Matching
  matching: {
    checkReadiness: () =>
      request<{
        all_ready: boolean;
        total: number;
        normalized: number;
        pending_cpses: string[];
      }>('/api/nmc/matching/readiness'),
    run: () =>
      request<{
        status: string;
        materials_count?: number;
        pairs_evaluated?: number;
        matches_created?: number;
        message?: string;
      }>('/api/nmc/matching/run', { method: 'POST' }),
    getResult: () =>
      request<{
        status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED';
        result?: {
          status: string;
          materials_count: number;
          pairs_evaluated: number;
          matches_created: number;
        };
        error?: string;
      }>('/api/nmc/matching/run/result'),
    status: () => request<any>('/api/nmc/matching/status'),
  },

  // Review Queue
  review: {
    getStats: (cpse_id?: string) => {
      const sp = new URLSearchParams();
      if (cpse_id) sp.set('cpse_id', cpse_id);
      return request<{ pending: number; different: number; mapped: number }>(
        `/api/nmc/review/stats?${sp.toString()}`
      );
    },
    getQueue: (params: {
      cpse_id?: string;
      status?: string;
      match_category?: string;
      page?: number;
      page_size?: number;
    }) => {
      const sp = new URLSearchParams();
      if (params.cpse_id) sp.set('cpse_id', params.cpse_id);
      if (params.status) sp.set('status', params.status);
      if (params.match_category) sp.set('match_category', params.match_category);
      if (params.page) sp.set('page', params.page.toString());
      if (params.page_size) sp.set('page_size', params.page_size.toString());
      return request<{
        items: any[];
        total: number;
        page: number;
        page_size: number;
        total_pages: number;
      }>(`/api/nmc/review/queue?${sp.toString()}`);
    },
    getMatch: (id: string) => request<any>(`/api/nmc/review/match/${id}`),
    submitDecision: (
      matchId: string,
      data: {
        decision: 'ACCEPT' | 'REJECT' | 'DIFFERENT' | 'OVERRIDE';
        override_outcome?: 'EQUIVALENT' | 'DIFFERENT';
        reason?: string;
        reviewer?: string;
        cpse_code?: string;
      }
    ) =>
      request<{ status: string; decision: any; cmm: any; message: string }>(
        `/api/nmc/review/${matchId}/decision`,
        {
          method: 'POST',
          body: JSON.stringify(data),
        }
      ),
  },

  // Common Material Master (CMM)
  cmm: {
    list: (params: { search?: string; material_family?: string; page?: number; page_size?: number }) => {
      const sp = new URLSearchParams();
      if (params.search) sp.set('search', params.search);
      if (params.material_family) sp.set('material_family', params.material_family);
      if (params.page) sp.set('page', params.page.toString());
      if (params.page_size) sp.set('page_size', params.page_size.toString());
      return request<{
        items: any[];
        total: number;
        page: number;
        page_size: number;
        total_pages: number;
      }>(`/api/nmc/cmm?${sp.toString()}`);
    },
    get: (id: string) => request<any>(`/api/nmc/cmm/${id}`),
  },

  // Analytics & Dashboard KPIs
  analytics: {
    getDashboardMetrics: () =>
      request<{
        total_cpsEs: number;
        total_materials: number;
        normalized_materials: number;
        mapped_materials: number;
        pending_reviews: number;
        total_national_codes: number;
        decisions_recorded?: number;
      }>('/api/nmc/analytics/dashboard'),
    getCPSEAnalytics: () => request<any[]>('/api/nmc/analytics/cpses'),
    getFullAnalytics: () => request<any>('/api/nmc/analytics/full'),
    getTopologyData: () => request<any>('/api/nmc/analytics/topology'),
  },

  // Audit Trail
  audit: {
    list: (params: {
      cpse_code?: string;
      action?: string;
      actor?: string;
      entity_type?: string;
      search?: string;
      page?: number;
      page_size?: number;
    }) => {
      const sp = new URLSearchParams();
      if (params.cpse_code) sp.set('cpse_code', params.cpse_code);
      if (params.action) sp.set('action', params.action);
      if (params.actor) sp.set('actor', params.actor);
      if (params.entity_type) sp.set('entity_type', params.entity_type);
      if (params.search) sp.set('search', params.search);
      if (params.page) sp.set('page', params.page.toString());
      if (params.page_size) sp.set('page_size', params.page_size.toString());
      return request<{
        items: any[];
        total: number;
        page: number;
        page_size: number;
        total_pages: number;
      }>(`/api/nmc/audit?${sp.toString()}`);
    },
  },
};

