// Mock localStorage for Node environment
global.localStorage = (() => {
  let store = {};
  return {
    getItem: (key) => store[key] || null,
    setItem: (key, value) => { store[key] = value.toString(); },
    clear: () => { store = {}; }
  };
})();

const { TaskQueue } = require('../js/queue.js');

console.log("=== Testing TaskQueue ===");

const mockClient = {
  createTaskCalls: [],
  shouldFail: false,
  async createTask(params) {
    if (this.shouldFail) throw new Error("Network simulated failure");
    this.createTaskCalls.push(params);
    return { id: 'mock_' + Date.now() };
  }
};

const queue = new TaskQueue(mockClient, 'test_queue');
queue.saveQueue([]); // reset

// Test 1: Enqueue
queue.enqueue({ categoryKey: '6-Купить', columnIdx: 2, title: 'Хлеб', priority: 0, tags: [] });
queue.enqueue({ categoryKey: '5-Роза', columnIdx: 1, title: 'Лестница', priority: 5, tags: ['🏀красный'] });

if (queue.size() !== 2) throw new Error(`Expected queue size 2, got ${queue.size()}`);
console.log("✓ Enqueue works, size = 2");

// Test 2: Sync with failure
mockClient.shouldFail = true;
queue.syncAll().then(async (res1) => {
  if (res1.failed !== 2 || queue.size() !== 2) {
    throw new Error(`Expected 2 failures and 2 items remaining, got ${JSON.stringify(res1)}`);
  }
  console.log("✓ Offline sync retention works");

  // Test 3: Sync with success
  mockClient.shouldFail = false;
  const res2 = await queue.syncAll();
  if (res2.synced !== 2 || queue.size() !== 0) {
    throw new Error(`Expected 2 synced and 0 remaining, got ${JSON.stringify(res2)}`);
  }
  console.log("✓ Successful sync clears queue");
  console.log("=== ALL QUEUE TESTS PASSED! ===");
}).catch(err => {
  console.error("Queue test failed:", err);
  process.exit(1);
});
