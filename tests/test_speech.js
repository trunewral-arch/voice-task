const { SpeechEngine } = require('../js/speech.js');

console.log("=== Testing SpeechEngine Architecture & Deduplication ===");

// 1. Test cleanRecognizedText
const cleanerCases = [
  { in: "Солнечный Солнечный Солнечный зайчик", out: "Солнечный зайчик" },
  { in: "купить молоко купить молоко", out: "купить молоко" },
  { in: "15 15 15 руб 15 руб кружева", out: "15 руб кружева" },
  { in: "Солнечный, Солнечный зайчик.", out: "Солнечный, зайчик." },
  { in: "купить хлеб на завтра купить хлеб", out: "купить хлеб на завтра" }
];

for (const c of cleanerCases) {
  const res = SpeechEngine.cleanRecognizedText(c.in);
  console.log(`cleanRecognizedText("${c.in}") -> "${res}"`);
  if (res !== c.out) {
    throw new Error(`Cleaner failed for "${c.in}": expected "${c.out}", got "${res}"`);
  }
}
console.log("✓ All cleaner test cases passed!");

// 2. Test multi-segment buffer accumulation (simulating Android pause)
let finalResult = null;
const engine = new SpeechEngine({
  onFinal: (text) => {
    finalResult = text;
  }
});

// User holds button
engine.isPressing = true;
engine.savedSegments = [];
engine.activeSegment = '';

// Phrase 1 before pause
engine.activeSegment = "Солнечный";
engine.commitActiveSegment();
console.log("Segment 1 saved:", engine.savedSegments);

// Android silence triggers restart, user speaks second part
engine.activeSegment = "зайчик надо купить";
engine.commitActiveSegment();
console.log("Segment 2 saved:", engine.savedSegments);

// User releases button
engine.isPressing = false;
engine.finalizeRecording();

console.log("Finalized result:", finalResult);
if (finalResult !== "Солнечный зайчик надо купить") {
  throw new Error(`Multi-segment failed: expected "Солнечный зайчик надо купить", got "${finalResult}"`);
}
console.log("✓ Multi-segment accumulation across pauses passed!");

console.log("=== ALL SPEECH ENGINE TESTS PASSED! ===");
