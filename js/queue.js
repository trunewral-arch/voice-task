/**
 * Offline Task Queue Manager for Voice Task PWA
 * Stores failed/offline tasks in localStorage and syncs automatically
 */

class TaskQueue {
  constructor(tickTickClient, storageKey = 'voicetask_offline_queue') {
    this.client = tickTickClient;
    this.storageKey = storageKey;
    this.isSyncing = false;
    this.onQueueChanged = () => {};
  }

  getQueue() {
    try {
      if (typeof localStorage === 'undefined') return [];
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error("Failed to read offline queue:", e);
      return [];
    }
  }

  saveQueue(items) {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(this.storageKey, JSON.stringify(items));
      this.onQueueChanged(items.length);
    } catch (e) {
      console.error("Failed to save offline queue:", e);
    }
  }

  enqueue(taskPayload) {
    const queue = this.getQueue();
    const item = {
      ...taskPayload,
      id: 'local_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      createdAt: new Date().toISOString()
    };
    queue.push(item);
    this.saveQueue(queue);
    return item;
  }

  size() {
    return this.getQueue().length;
  }

  async syncAll() {
    if (this.isSyncing) return { synced: 0, failed: 0 };
    const queue = this.getQueue();
    if (queue.length === 0) return { synced: 0, failed: 0 };

    this.isSyncing = true;
    let synced = 0;
    let failed = 0;
    const remaining = [];

    for (const item of queue) {
      try {
        await this.client.createTask({
          categoryKey: item.categoryKey,
          columnIdx: item.columnIdx,
          title: item.title,
          content: item.content,
          priority: item.priority,
          tags: item.tags
        });
        synced++;
      } catch (err) {
        console.warn("Failed to sync queued task:", item.title, err);
        failed++;
        remaining.push(item);
      }
    }

    this.saveQueue(remaining);
    this.isSyncing = false;
    return { synced, failed, remaining: remaining.length };
  }
}

if (typeof module !== 'undefined') {
  module.exports = { TaskQueue };
}
