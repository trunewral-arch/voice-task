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
  },
  {
    input: "купить 2 жёлтый мелкий в магазине чижик сыр",
    expectedColumn: 2,
    expectedPriority: 3,
    expectedPriorityTag: "🥎жолтый",
    expectedSizeTag: "мелкий",
    expectedTitle: "В магазине чижик сыр"
  },
  {
    input: "купить хлеб вход план сейчас потом инфо",
    expectedColumn: 4, // last mentioned column: инфо
    expectedPriority: 0,
    expectedPriorityTag: null,
    expectedSizeTag: null,
    expectedTitle: "Хлеб"
  },
  {
    input: "купить молоко инфо потом сейчас план вход",
    expectedColumn: 0, // last mentioned column: вход
    expectedPriority: 0,
    expectedPriorityTag: null,
    expectedSizeTag: null,
    expectedTitle: "Молоко"
  },
  {
    input: "починить замок красный а нет жёлтый",
    expectedColumn: null,
    expectedPriority: 3, // last mentioned priority: жёлтый
    expectedPriorityTag: "🥎жолтый",
    expectedSizeTag: null,
    expectedTitle: "Починить замок"
  },
  {
    input: "написать отчет жёлтый а нет красный",
    expectedColumn: null,
    expectedPriority: 5, // last mentioned priority: красный
    expectedPriorityTag: "🏀красный",
    expectedSizeTag: null,
    expectedTitle: "Написать отчет"
  },
  {
    input: "проверить почту красный а нет обычный",
    expectedColumn: null,
    expectedPriority: 0, // reset to обычный
    expectedPriorityTag: null,
    expectedSizeTag: null,
    expectedTitle: "Проверить почту"
  },
  {
    input: "убрать в гараже мелкий а нет большой",
    expectedColumn: null,
    expectedPriority: 0,
    expectedPriorityTag: null,
    expectedSizeTag: "большой", // last mentioned size: большой
    expectedTitle: "Убрать в гараже"
  },
  {
    input: "помыть окно большой а нет без размера",
    expectedColumn: null,
    expectedPriority: 0,
    expectedPriorityTag: null,
    expectedSizeTag: null, // reset to без размера
    expectedTitle: "Помыть окно"
  },
  // User bug report test cases:
  {
    input: "Солнечный Солнечный Солнечный зайчик надо купить",
    expectedColumn: null,
    expectedPriority: 0,
    expectedPriorityTag: null,
    expectedSizeTag: null,
    expectedTitle: "Солнечный зайчик"
  },
  {
    input: "купить Солнечный зайчик Солнечный зайчик",
    expectedColumn: null,
    expectedPriority: 0,
    expectedPriorityTag: null,
    expectedSizeTag: null,
    expectedTitle: "Солнечный зайчик"
  },
  {
    input: "купить молоко на вечер купить молоко",
    expectedColumn: null,
    expectedPriority: 0,
    expectedPriorityTag: null,
    expectedSizeTag: null,
    expectedTitle: "Молоко на вечер"
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
