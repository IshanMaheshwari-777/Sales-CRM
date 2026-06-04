import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MobileQueueLead, QuickUpdateInput } from './types';

const pendingKey = (userId: string) => `mobile_pending_updates:${userId}`;
const queueCacheKey = (userId: string) => `mobile_queue_cache:${userId}`;

type PendingQuickUpdate = QuickUpdateInput & {
  queuedAt: string;
};

export async function loadCachedQueue(userId: string): Promise<MobileQueueLead[]> {
  const raw = await AsyncStorage.getItem(queueCacheKey(userId));
  if (!raw) return [];

  try {
    return JSON.parse(raw) as MobileQueueLead[];
  } catch {
    return [];
  }
}

export async function cacheQueue(userId: string, queue: MobileQueueLead[]): Promise<void> {
  await AsyncStorage.setItem(queueCacheKey(userId), JSON.stringify(queue));
}

export async function listPendingQuickUpdates(userId: string): Promise<PendingQuickUpdate[]> {
  const raw = await AsyncStorage.getItem(pendingKey(userId));
  if (!raw) return [];

  try {
    return JSON.parse(raw) as PendingQuickUpdate[];
  } catch {
    return [];
  }
}

export async function enqueueQuickUpdate(userId: string, update: QuickUpdateInput): Promise<void> {
  const pending = await listPendingQuickUpdates(userId);
  pending.push({
    ...update,
    queuedAt: new Date().toISOString(),
  });

  await AsyncStorage.setItem(pendingKey(userId), JSON.stringify(pending));
}

export async function clearPendingQuickUpdates(userId: string): Promise<void> {
  await AsyncStorage.removeItem(pendingKey(userId));
}

export async function replacePendingQuickUpdates(userId: string, updates: PendingQuickUpdate[]): Promise<void> {
  await AsyncStorage.setItem(pendingKey(userId), JSON.stringify(updates));
}

export function shouldQueueOffline(error: unknown): boolean {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return (
    message.includes('network') ||
    message.includes('fetch') ||
    message.includes('timeout') ||
    message.includes('connection') ||
    message.includes('offline')
  );
}
