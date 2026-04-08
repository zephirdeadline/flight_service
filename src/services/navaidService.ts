import { invoke } from '@tauri-apps/api/core';
import type { Navaid } from '../types';

export const navaidService = {
  async getAllNavaids(): Promise<Navaid[]> {
    return await invoke<Navaid[]>('get_all_navaids');
  },

  async searchNavaids(query: string): Promise<Navaid[]> {
    return await invoke<Navaid[]>('search_navaids', { query });
  },
};
