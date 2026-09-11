/**
 * Material Service
 * Abstracts API communication for material-related operations with mock fallback
 */

import type { Material, MaterialAttribute } from '@/types';
import { mockMaterials } from '@/lib/mock/materials';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000';

export const materialService = {
  async getMaterials(params?: {
    page?: number;
    limit?: number;
    cpseId?: string;
    category?: string;
    status?: string;
  }): Promise<Material[]> {
    try {
      const res = await fetch(`${API_BASE}/api/materials`);
      if (res.ok) return await res.json();
    } catch {
      // Use mock fallback when backend is offline
    }
    return mockMaterials;
  },

  async getMaterial(id: string): Promise<Material | null> {
    try {
      const res = await fetch(`${API_BASE}/api/materials/${id}`);
      if (res.ok) return await res.json();
    } catch {
      // Use mock fallback when backend is offline
    }
    return mockMaterials.find((m) => m.id === id) ?? null;
  },

  async searchMaterials(query: string): Promise<Material[]> {
    const q = query.toLowerCase();
    return mockMaterials.filter(
      (m) =>
        m.description.toLowerCase().includes(q) ||
        m.materialCode.toLowerCase().includes(q) ||
        m.cpseId.toLowerCase().includes(q)
    );
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