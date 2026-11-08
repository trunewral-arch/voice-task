const { TaskParser } = require('../js/parser.js');

const testCases = [
  {
    input: "купить 2 жолтый мелкий в магазине чижик хлеб",
    expectedColumn: 2,
    expectedPriority: 3,
    expectedPriorityTag: "🥎жолтый",
    expectedSizeTag: "мелкий",
    expectedTitle: "В магазине чижик хлеб"
  },
  {
    input: "запиши красный большой перебрать двигатель в гараже",
    expectedColumn: null, // use default
    expectedPriority: 5,
    expectedPriorityTag: "🏀красный",
    expectedSizeTag: "большой",
    expectedTitle: "Перебрать двигатель в гараже"
  },
  {
    input: "поставить лестницу на место потом",
    expectedColumn: 3, // 3-Потом
    expectedPriority: 0,
    expectedPriorityTag: null,
    expectedSizeTag: null,
    expectedTitle: "Поставить лестницу на место"
  },
  {
    input: "короче 4 замерить напряжение аккумулятора инфо",
    expectedColumn: 4, // 4-Заметка
    expectedPriority: 0,
    expectedPriorityTag: null,
    expectedSizeTag: null,
    expectedTitle: "Замерить напряжение аккумулятора"
  },
  {
    input: "срочно один подготовить договор для клиента",
    expectedColumn: 1, // 1-Задача
    expectedPriority: 5, // срочно = красный
    expectedPriorityTag: "🏀красный",
    expectedSizeTag: null,
    expectedTitle: "Подготовить договор для клиента"
  },
  {
    input: "желтый быстро купить батарейки cr2032",
    expectedColumn: null,
    expectedPriority: 3,
    expectedPriorityTag: "🥎жолтый",
    expectedSizeTag: "мелкий", // быстро = мелкий
    expectedTitle: "Батарейки cr2032"
  }
];

console.log("=== Testing TaskParser ===");
let passed = 0;
for (const tc of testCases) {
  const result = TaskParser.parse(tc.input);
  console.log(`Input: "${tc.input}"`);
  console.log(`  Parsed: title="${result.title}", col=${result.columnIdx}, prio=${result.priority}, tags=${JSON.stringify(result.tags)}`);

  if (tc.expectedColumn !== null && result.columnIdx !== tc.expectedColumn) {
    throw new Error(`Column mismatch for "${tc.input}": expected ${tc.expectedColumn}, got ${result.columnIdx}`);
  }
  if (result.priority !== tc.expectedPriority) {
    throw new Error(`Priority mismatch for "${tc.input}": expected ${tc.expectedPriority}, got ${result.priority}`);
  }
  if (tc.expectedPriorityTag && !result.tags.includes(tc.expectedPriorityTag)) {
    throw new Error(`Priority tag missing for "${tc.input}": expected ${tc.expectedPriorityTag}`);
  }
  if (tc.expectedSizeTag && !result.tags.includes(tc.expectedSizeTag)) {
    throw new Error(`Size tag missing for "${tc.input}": expected ${tc.expectedSizeTag}`);
  }
  if (result.title.toLowerCase() !== tc.expectedTitle.toLowerCase()) {
    throw new Error(`Title mismatch for "${tc.input}": expected "${tc.expectedTitle}", got "${result.title}"`);
  }
  passed++;
}

console.log(`=== ALL ${passed} PARSER TESTS PASSED! ===`);
