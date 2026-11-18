const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env');
const token = fs.readFileSync(envPath, 'utf8').match(/TICKTICK_TOKEN=([^\r\n]+)/)[1].trim();

const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};

const PROJECTS = [
  { name: '0-Радар', id: '5f4eb2848f08450b91e39d81', col2: '6af08fb08f082b1308153254' },
  { name: '1-Лабс',  id: '5f4eb2848f08450b91e39d84', col2: '6af08fb68f082b130815330e' },
  { name: '2-Лиды',  id: '5f4eb2858f08450b91e39da9', col2: '6af08fbc8f082b13081534c7' },
  { name: '3-Вайб',  id: '5f4eb2838f08450b91e39d5c', col2: '6af08fc48f086e9230b39d43' },
  { name: '4-Разное',id: '5f4eb2858f08450b91e39d93', col2: '6af08fca8f082b13081537b6' },
  { name: '5-Роза',  id: '5f4eb2848f08450b91e39d78', col2: '6af08fd08f080cb36f765010' },
  { name: '6-Купить',id: '93b74535a17b687b071ce09d', col2: '6af08fd68f0899596f1d9538' },
  { name: '7-Тело',  id: '1e234df6becf5fef03498050', col2: '6af08fdc8f0899596f1d95f0' }
];

const TARGET_TAG = 'сейчас';

async function syncTickTick(dryRun = false) {
  const summary = {
    added: [],
    removed: [],
    untouched: 0
  };

  for (const p of PROJECTS) {
    const res = await fetch(`https://api.ticktick.com/open/v1/project/${p.id}/data`, { headers });
    if (!res.ok) {
      console.error(`Failed to fetch project ${p.name}: ${res.status}`);
      continue;
    }
    const data = await res.json();
    const tasks = data.tasks || [];

    for (const t of tasks) {
      const currentTags = t.tags || [];
      const hasTargetTag = currentTags.includes(TARGET_TAG);
      const isInCol2 = t.columnId === p.col2;

      if (isInCol2 && !hasTargetTag) {
        // Need to ADD tag 'сейчас'
        const newTags = [...currentTags, TARGET_TAG];
        summary.added.push({ task: t.title, project: p.name });
        if (!dryRun) {
          await fetch(`https://api.ticktick.com/open/v1/task/${t.id}`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ id: t.id, projectId: t.projectId, tags: newTags })
          });
        }
      } else if (!isInCol2 && hasTargetTag) {
        // Need to REMOVE tag 'сейчас'
        const newTags = currentTags.filter(tag => tag !== TARGET_TAG);
        summary.removed.push({ task: t.title, project: p.name });
        if (!dryRun) {
          await fetch(`https://api.ticktick.com/open/v1/task/${t.id}`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ id: t.id, projectId: t.projectId, tags: newTags })
          });
        }
      } else {
        summary.untouched++;
      }
    }
  }

  return summary;
}

async function runTests() {
  console.log("=== STARTING INTEGRATION TESTS FOR TICKTICK SYNC ===");
  const testProject = PROJECTS.find(p => p.name === '4-Разное');
  const col0Id = '6af08fc88f0866ff5ff765bc'; // 0-Вход
  const col2Id = testProject.col2;           // 2-Сейчас
  const col3Id = '6af08fcb8f086e9230b39e02'; // 3-Потом

  // Step 1: Create a test task in 0-Вход with tag 'мелкий'
  console.log("\n[Test 1] Creating test task in 0-Вход with tag ['мелкий']...");
  const createRes = await fetch('https://api.ticktick.com/open/v1/task', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      title: 'TEST_SYNC_AUTO_TASK',
      projectId: testProject.id,
      columnId: col0Id,
      tags: ['мелкий']
    })
  });
  const testTask = await createRes.json();
  console.log(`Created test task id: ${testTask.id}`);

  try {
    // Step 2: Run sync -> should NOT touch task (it's in 0-Вход and has no 'сейчас')
    console.log("\n[Test 2] Running sync with task in 0-Вход...");
    let s = await syncTickTick(false);
    console.log("Sync summary:", s);
    let checkRes = await fetch(`https://api.ticktick.com/open/v1/project/${testProject.id}/data`, { headers });
    let checkData = await checkRes.json();
    let task = checkData.tasks.find(t => t.id === testTask.id);
    if (!task.tags.includes('сейчас') && task.tags.includes('мелкий')) {
      console.log("PASS: Task remains untouched in 0-Вход with tags:", task.tags);
    } else {
      throw new Error(`FAIL: Unexpected tags: ${JSON.stringify(task.tags)}`);
    }

    // Step 3: Move task to 2-Сейчас
    console.log("\n[Test 3] Moving task to 2-Сейчас...");
    await fetch(`https://api.ticktick.com/open/v1/task/${testTask.id}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: testTask.id, projectId: testProject.id, columnId: col2Id })
    });

    // Step 4: Run sync -> should ADD 'сейчас', keeping 'мелкий'
    console.log("\n[Test 4] Running sync after moving to 2-Сейчас...");
    s = await syncTickTick(false);
    console.log("Sync summary:", s);
    checkRes = await fetch(`https://api.ticktick.com/open/v1/project/${testProject.id}/data`, { headers });
    checkData = await checkRes.json();
    task = checkData.tasks.find(t => t.id === testTask.id);
    if (task.tags.includes('сейчас') && task.tags.includes('мелкий')) {
      console.log("PASS: 'сейчас' successfully ADDED while preserving 'мелкий':", task.tags);
    } else {
      throw new Error(`FAIL: Tags mismatch: ${JSON.stringify(task.tags)}`);
    }

    // Step 5: Move task to 3-Потом
    console.log("\n[Test 5] Moving task to 3-Потом...");
    await fetch(`https://api.ticktick.com/open/v1/task/${testTask.id}`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: testTask.id, projectId: testProject.id, columnId: col3Id })
    });

    // Step 6: Run sync -> should REMOVE 'сейчас', keeping 'мелкий'
    console.log("\n[Test 6] Running sync after moving out of 2-Сейчас...");
    s = await syncTickTick(false);
    console.log("Sync summary:", s);
    checkRes = await fetch(`https://api.ticktick.com/open/v1/project/${testProject.id}/data`, { headers });
    checkData = await checkRes.json();
    task = checkData.tasks.find(t => t.id === testTask.id);
    if (!task.tags.includes('сейчас') && task.tags.includes('мелкий')) {
      console.log("PASS: 'сейчас' successfully REMOVED while preserving 'мелкий':", task.tags);
    } else {
      throw new Error(`FAIL: Tags mismatch: ${JSON.stringify(task.tags)}`);
    }

    console.log("\n=== ALL INTEGRATION TESTS PASSED PERFECTLY! ===");
  } finally {
    // Step 7: Delete test task
    console.log("\n[Cleanup] Deleting test task...");
    await fetch(`https://api.ticktick.com/open/v1/task/${testTask.id}`, {
      method: 'DELETE',
      headers
    });
    console.log("Cleanup completed.");
  }
}

runTests().catch(err => {
  console.error("Test failed with error:", err);
  process.exit(1);
});
