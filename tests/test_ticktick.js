const fs = require('fs');
const path = require('path');
const { TickTickClient, TICKTICK_CONFIG } = require('../js/ticktick.js');

function loadToken() {
  if (process.env.TICKTICK_TOKEN) return process.env.TICKTICK_TOKEN;
  const envPath = path.resolve(__dirname, '../.env');
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, 'utf8');
    const match = content.match(/TICKTICK_TOKEN=([^\r\n]+)/);
    if (match) return match[1].trim();
  }
  return null;
}

async function runTests() {
  console.log("=== Testing TickTick Client ===");
  const token = loadToken();
  const client = new TickTickClient(token);

  // Test 1: Configuration integrity
  const projects = Object.keys(TICKTICK_CONFIG.projects);
  if (projects.length !== 8) {
    throw new Error(`Expected 8 projects, got ${projects.length}`);
  }
  console.log("✓ Projects count = 8");

  // Test 2: Check all projects have 5 columns mapped
  for (const [name, meta] of Object.entries(TICKTICK_CONFIG.projects)) {
    const cols = TICKTICK_CONFIG.columnMap[meta.id];
    if (!cols || Object.keys(cols).length !== 5) {
      throw new Error(`Project ${name} missing 5 column mappings!`);
    }
  }
  console.log("✓ All 8 projects have 5 canonical columns mapped!");

  // Test 3: Live API creation of a verification task in '4-Разное' -> '0-Неотсортирован'
  console.log("Testing live task creation in TickTick...");
  try {
    const task = await client.createTask({
      categoryKey: '4-Разное',
      columnIdx: 0,
      title: 'Автоматическая проверка API Voice Task PWA',
      content: 'Создано модульным тестом Task 1',
      priority: 0,
      tags: []
    });
    console.log(`✓ Live task created successfully! Task ID: ${task.id}`);
  } catch (err) {
    console.error("Live test error:", err.message);
    throw err;
  }

  console.log("=== ALL TICKTICK TESTS PASSED! ===");
}

runTests().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
