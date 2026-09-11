/**
 * Material Service
 * Abstracts API communication for material-related operations with dataset scoping
 */

import type { Material, MaterialAttribute } from '@/types';
import { mockMaterials } from '@/lib/mock/materials';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export interface MaterialsResponse {
  materials: Material[];
  total: number;
  skip: number;
  limit: number;
  dataset_id: string;
}

export const materialService = {
  async getMaterials(params?: {
    page?: number;
    skip?: number;
    limit?: number;
    cpseId?: string;
    category?: string;
    status?: string;
    search?: string;
    datasetId?: string;
  }): Promise<MaterialsResponse> {
    const skip = params?.skip ?? (params?.page ? (params.page - 1) * (params.limit || 50) : 0);
    const limit = params?.limit ?? 50;
    const query = new URLSearchParams();
    query.set('skip', skip.toString());
    query.set('limit', limit.toString());
    if (params?.cpseId && params.cpseId !== 'all') query.set('cpse', params.cpseId);
    if (params?.category && params.category !== 'all') query.set('category', params.category);
    if (params?.status && params.status !== 'all') query.set('status', params.status);
    if (params?.search) query.set('search', params.search);
    if (params?.datasetId) query.set('dataset_id', params.datasetId);

    try {
      const res = await fetch(`${API_BASE}/api/materials?${query.toString()}`);
      if (res.ok) {
        const data = await res.json();
        return data;
      }
    } catch {
      // Offline fallback
    }

    return {
      materials: mockMaterials.slice(skip, skip + limit),
      total: mockMaterials.length,
      skip,
      limit,
      dataset_id: params?.datasetId || 'BASELINE',
    };
  },

  async getMaterial(id: string, datasetId?: string): Promise<Material | null> {
    try {
      const query = datasetId ? `?dataset_id=${encodeURIComponent(datasetId)}` : '';
      const res = await fetch(`${API_BASE}/api/materials/${encodeURIComponent(id)}${query}`);
      if (res.ok) return await res.json();
    } catch {
      // Use mock fallback when backend is offline
    }
    return mockMaterials.find((m) => m.id === id || m.materialCode === id) ?? null;
  },

  async searchMaterials(query: string, datasetId?: string): Promise<Material[]> {
    const res = await this.getMaterials({ search: query, datasetId, limit: 100 });
    return res.materials;
  },

  async getMaterialAttributes(materialId: string): Promise<MaterialAttribute[]> {
    return [];
  },

  async updateMaterial(id: string, data: Partial<Material>): Promise<Material | null> {
    return null;
  },

  async bulkUpdateMaterials(ids: string[], data: Partial<Material>): Promise<Material[]> {
    return [];
  },
};