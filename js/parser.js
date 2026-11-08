/**
 * Russian Speech NLP Task Parser for Voice Task PWA
 * Parses columns, priorities, size tags, and cleans task titles
 */

function matchAndStripAll(text, regex) {
  let matched = false;
  let current = text;
  while (true) {
    const match = current.match(regex);
    if (!match) break;
    matched = true;
    current = current.replace(regex, (m, word) => m.replace(word, ' '));
  }
  return { matched, text: current };
}

const TaskParser = {
  // Rules for column detection
  columns: [
    { idx: 0, name: "0-Вход",   pattern: /(?:^|[\s,.:;!?])(ноль|0|вход|инбокс|неотсорт[а-я]*)(?=$|[\s,.:;!?])/i },
    { idx: 1, name: "1-План",   pattern: /(?:^|[\s,.:;!?])(один|1|план|задач[а-я]*|бэклог)(?=$|[\s,.:;!?])/i },
    { idx: 2, name: "2-Сейчас", pattern: /(?:^|[\s,.:;!?])(два|2|сейчас|в работе|сегодня|срочно делать)(?=$|[\s,.:;!?])/i },
    { idx: 3, name: "3-Потом",  pattern: /(?:^|[\s,.:;!?])(три|3|потом|позже|когда-нибудь|отложи)(?=$|[\s,.:;!?])/i },
    { idx: 4, name: "4-Инфо",   pattern: /(?:^|[\s,.:;!?])(четыре|4|инфо|инфа|заметк[а-я]*|записка)(?=$|[\s,.:;!?])/i }
  ],

  // Rules for priority detection
  priorities: [
    { tag: "🏀красный", priority: 5, pattern: /(?:^|[\s,.:;!?])(красн[а-я]*|огонь|критично|срочно)(?=$|[\s,.:;!?])/i },
    { tag: "🥎жолтый",  priority: 3, pattern: /(?:^|[\s,.:;!?])(ж[ео]лт[а-я]*|важн[а-я]*)(?=$|[\s,.:;!?])/i }
  ],

  // Rules for task size detection
  sizes: [
    { tag: "мелкий",   pattern: /(?:^|[\s,.:;!?])(мелк[а-я]*|быстр[а-я]*|пятиминутка)(?=$|[\s,.:;!?])/i },
    { tag: "большой",  pattern: /(?:^|[\s,.:;!?])(больш[а-я]*|долг[а-я]*|проект)(?=$|[\s,.:;!?])/i }
  ],

  // Words to strip completely
  garbageWords: [
    /(?:^|[\s,.:;!?])(запиши|добавь|пометь|напомни|короче|слушай|эээ|ну|так|в общем)(?=$|[\s,.:;!?])/gi
  ],

  // Remove leading category words like "купить" if dictated inside the "6-Купить" project
  categoryPrefixes: [
    /(?:^|[\s,.:;!?])(купить|покупка|вайб|лиды|лабс|радар|тело|здоровье|роза|разное)(?=$|[\s,.:;!?])/i
  ],

  parse(rawText, activeCategoryName = '') {
    if (!rawText || typeof rawText !== 'string') {
      return {
        title: '',
        columnIdx: null,
        priority: 0,
        priorityTag: null,
        sizeTag: null,
        tags: []
      };
    }

    let text = rawText.trim();
    let detectedCol = null;
    let detectedPrio = 0;
    let detectedPrioTag = null;
    let detectedSizeTag = null;
    const tags = [];

    // 1. Detect and remove column keywords
    for (const col of this.columns) {
      const res = matchAndStripAll(text, col.pattern);
      if (res.matched) {
        if (detectedCol === null) detectedCol = col.idx;
        text = res.text;
      }
    }

    // 2. Detect and remove priority keywords
    for (const prio of this.priorities) {
      const res = matchAndStripAll(text, prio.pattern);
      if (res.matched) {
        if (!detectedPrioTag) {
          detectedPrio = prio.priority;
          detectedPrioTag = prio.tag;
        }
        text = res.text;
      }
    }

    // 3. Detect and remove size keywords
    for (const size of this.sizes) {
      const res = matchAndStripAll(text, size.pattern);
      if (res.matched) {
        if (!detectedSizeTag) {
          detectedSizeTag = size.tag;
        }
        text = res.text;
      }
    }

    // 4. Remove garbage words
    for (const gPattern of this.garbageWords) {
      text = text.replace(gPattern, ' ');
    }

    // 5. Remove redundant category prefix from start if speech starts with category name (e.g. "купить ...")
    for (const cPattern of this.categoryPrefixes) {
      text = text.replace(cPattern, ' ');
    }

    // 6. Clean up whitespace and capitalize first letter
    text = text.replace(/\s+/g, ' ').trim();
    if (text.length > 0) {
      text = text.charAt(0).toUpperCase() + text.slice(1);
    }

    // Populate tags array
    if (detectedPrioTag) tags.push(detectedPrioTag);
    if (detectedSizeTag) tags.push(detectedSizeTag);

    return {
      title: text,
      columnIdx: detectedCol,
      priority: detectedPrio,
      priorityTag: detectedPrioTag,
      sizeTag: detectedSizeTag,
      tags: tags
    };
  }
};

if (typeof module !== 'undefined') {
  module.exports = { TaskParser };
}
