'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiFetch } from '@/lib/api';

interface UseSupabaseDataOptions {
  tableName: string;
  select?: string;
  filters?: Record<string, string>;
  orderBy?: string;
  orderAsc?: boolean;
  limit?: number;
  autoFetch?: boolean;
}

interface UseSupabaseDataResult<T> {
  data: T[];
  count: number;
  loading: boolean;
  error: string | null;
  dbReady: boolean;
  refetch: () => Promise<void>;
}

// Global cache for db ready state
let _dbReadyCache: boolean | null = null;

export function useSupabaseData<T = any>(
  options: UseSupabaseDataOptions
): UseSupabaseDataResult<T> {
  const { tableName, select = '*', filters, orderBy = 'created_at', orderAsc = false, limit = 100, autoFetch = true } = options;

  const [data, setData] = useState<T[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dbReady, setDbReady] = useState(false);

  const checkDbReady = useCallback(async () => {
    if (_dbReadyCache !== null) {
      setDbReady(_dbReadyCache);
      return _dbReadyCache;
    }

    try {
      const json = await apiFetch<{ dbReady: boolean }>('/api/setup');
      const ready = json.dbReady === true;
      _dbReadyCache = ready;
      setDbReady(ready);
      return ready;
    } catch {
      setDbReady(false);
      return false;
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const ready = await checkDbReady();
      if (!ready) {
        setData([]);
        setCount(0);
        setLoading(false);
        return;
      }

      // Build query params
      const params = new URLSearchParams();
      params.set('table', tableName);
      params.set('select', select);
      if (orderBy) params.set('orderBy', orderBy);
      params.set('orderAsc', String(orderAsc));
      if (limit) params.set('limit', String(limit));
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          params.set(`filter_${key}`, value);
        });
      }

      // Use the generic data endpoint
      const { supabase } = await import('@/lib/supabase');

      let query = supabase.from(tableName).select(select, { count: 'exact' });

      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      query = query.order(orderBy, { ascending: orderAsc });
      if (limit) query = query.limit(limit);

      const { data: result, count: total, error: queryError } = await query;

      if (queryError) {
        if (queryError.code === 'PGRST205') {
          _dbReadyCache = false;
          setDbReady(false);
          setData([]);
          setCount(0);
        } else {
          setError(queryError.message);
        }
      } else {
        setData((result || []) as T[]);
        setCount(total || 0);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [tableName, select, JSON.stringify(filters), orderBy, orderAsc, limit, checkDbReady]);

  useEffect(() => {
    if (autoFetch) {
      fetchData();
    }
  }, [autoFetch, fetchData]);

  return { data, count, loading, error, dbReady, refetch: fetchData };
}

// Hook specifically for dashboard stats
export function useDashboardStats() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [dbReady, setDbReady] = useState(false);

  const fetchStats = useCallback(async () => {
    try {
      const json = await apiFetch<{ dbReady: boolean; stats: any }>('/api/stats');
      setDbReady(json.dbReady);
      if (json.stats) {
        setStats(json.stats);
      }
    } catch {
      setDbReady(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return { stats, loading, dbReady, refetch: fetchStats };
}

// Reset the db ready cache when tables are created
export function resetDbReadyCache() {
  _dbReadyCache = null;
}
