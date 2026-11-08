/**
 * Russian Speech NLP Task Parser for Voice Task PWA
 * Parses columns, priorities, size tags, and cleans task titles
 * Supports real-time chronological switching (the last spoken command takes precedence)
 */

// Cleans up any stutter, duplicated words or repeated phrases (1-grams, N-grams, suffix echoes)
function cleanRecognizedText(str) {
  if (!str || typeof str !== 'string') return '';
  let tokens = str.trim().split(/\s+/);

  const norm = (w) => w.toLowerCase().replace(/^[.,!?:;"'«»—\-]+|[.,!?:;"'«»—\-]+$/g, '');

  // 1. Remove consecutive identical tokens (1-grams): 'собак собак' -> 'собак'
  let out = [];
  for (let i = 0; i < tokens.length; i++) {
    const currNorm = norm(tokens[i]);
    const prevNorm = i > 0 ? norm(tokens[i - 1]) : '';
    if (i > 0 && currNorm && currNorm === prevNorm) {
      continue;
    }
    out.push(tokens[i]);
  }
  tokens = out;

  // 2. Remove any repeated n-gram phrase of length k (from k = floor(len/2) down to 2)
  let changed = true;
  while (changed) {
    changed = false;
    const len = tokens.length;
    for (let k = Math.floor(len / 2); k >= 2; k--) {
      for (let i = 0; i <= len - 2 * k; i++) {
        let match = true;
        for (let j = 0; j < k; j++) {
          if (norm(tokens[i + j]) !== norm(tokens[i + k + j])) {
            match = false;
            break;
          }
        }
        if (match) {
          tokens.splice(i + k, k);
          changed = true;
          break;
        }
      }
      if (changed) break;
    }
  }

  // 3. Suffix echo check: if the end of the tokens matches ANY earlier multi-word slice
  for (let suffixLen = Math.floor(tokens.length / 2); suffixLen >= 2; suffixLen--) {
    const suffixNorm = tokens.slice(tokens.length - suffixLen).map(t => norm(t)).join(' ');
    const restNorm = tokens.slice(0, tokens.length - suffixLen).map(t => norm(t)).join(' ');
    if (restNorm.includes(suffixNorm) && suffixNorm.length > 0) {
      tokens = tokens.slice(0, tokens.length - suffixLen);
      break;
    }
  }

  return tokens.join(' ').trim();
}

const TaskParser = {
  // Rules for column detection
  columns: [
    { idx: 0, name: "0-Вход",   pattern: /(?:^|[\s,.:;!?])(ноль|0|вход[а-яё]*|инбокс[а-яё]*|неотсорт[а-яё]*|входящ[а-яё]*)(?=$|[\s,.:;!?])/gi },
    { idx: 1, name: "1-План",   pattern: /(?:^|[\s,.:;!?])(один|1|план[а-яё]*|задач[а-яё]*|бэклог[а-яё]*|запланируй)(?=$|[\s,.:;!?])/gi },
    { idx: 2, name: "2-Сейчас", pattern: /(?:^|[\s,.:;!?])(два|2|сейчас|в работе|сегодня|срочно делать|в процесс[а-яё]*)(?=$|[\s,.:;!?])/gi },
    { idx: 3, name: "3-Потом",  pattern: /(?:^|[\s,.:;!?])(три|3|потом|позже|когда-нибудь|отложи|на потом)(?=$|[\s,.:;!?])/gi },
    { idx: 4, name: "4-Инфо",   pattern: /(?:^|[\s,.:;!?])(четыре|4|инфо[а-яё]*|инфа|заметк[а-яё]*|записк[а-яё]*|информаци[а-яё]*)(?=$|[\s,.:;!?])/gi }
  ],

  // Rules for priority detection (including reset to 0 / Обычный)
  priorities: [
    { tag: "🏀красный", priority: 5, pattern: /(?:^|[\s,.:;!?])(красн[а-яё]*|огонь|критичн[а-яё]*|срочн[а-яё]*)(?=$|[\s,.:;!?])/gi },
    { tag: "🥎жолтый",  priority: 3, pattern: /(?:^|[\s,.:;!?])(ж[еёо]лт[а-яё]*|важн[а-яё]*)(?=$|[\s,.:;!?])/gi },
    { tag: null,        priority: 0, pattern: /(?:^|[\s,.:;!?])(обычн[а-яё]*|стандартн[а-яё]*|без приоритета|сбрось приоритет)(?=$|[\s,.:;!?])/gi }
  ],

  // Rules for task size detection (including reset to null / Без)
  sizes: [
    { tag: "мелкий",  pattern: /(?:^|[\s,.:;!?])(мелк[а-яё]*|быстр[а-яё]*|пятиминутк[а-яё]*|коротк[а-яё]*)(?=$|[\s,.:;!?])/gi },
    { tag: "большой", pattern: /(?:^|[\s,.:;!?])(больш[а-яё]*|долг[а-яё]*|проект[а-яё]*|длинн[а-яё]*|тяж[её]л[а-яё]*)(?=$|[\s,.:;!?])/gi },
    { tag: null,      pattern: /(?:^|[\s,.:;!?])(без размера|без метки|сбрось размер|нормальн[а-яё]*)(?=$|[\s,.:;!?])/gi }
  ],

  // Words to strip completely
  garbageWords: [
    /(?:^|[\s,.:;!?])(надо|нужно|необходимо|запиши|добавь|пометь|напомни|короче|слушай|эээ|ну|так|в общем|а нет|нет|хотя)(?=$|[\s,.:;!?])/gi
  ],

  // Remove leading category words like "купить" if dictated inside the "6-Купить" project
  categoryPrefixes: [
    /(?:^|[\s,.:;!?])(купить|покупка|вайб|лиды|лабс|радар|тело|здоровье|роза|разное)(?=$|[\s,.:;!?])/gi
  ],

  cleanRecognizedText: cleanRecognizedText,

  parse(rawText, activeCategoryName = '') {
    if (!rawText || typeof rawText !== 'string') {
      return {
        title: '',
        columnIdx: null,
        priority: 0,
        priorityTag: null,
        sizeTag: null,
        tags: [],
        hasExplicitPriority: false,
        hasExplicitSize: false
      };
    }

    const textRaw = cleanRecognizedText(rawText.trim());

    // 1. Find all column occurrences and their positions (chronological order)
    const colOccurrences = [];
    for (const col of this.columns) {
      const rx = new RegExp(col.pattern.source, 'gi');
      let m;
      while ((m = rx.exec(textRaw)) !== null) {
        colOccurrences.push({ pos: m.index, val: col.idx });
      }
    }
    colOccurrences.sort((a, b) => a.pos - b.pos);
    const detectedCol = colOccurrences.length > 0 ? colOccurrences[colOccurrences.length - 1].val : null;

    // 2. Find all priority occurrences and their positions
    const prioOccurrences = [];
    for (const prio of this.priorities) {
      const rx = new RegExp(prio.pattern.source, 'gi');
      let m;
      while ((m = rx.exec(textRaw)) !== null) {
        prioOccurrences.push({ pos: m.index, priority: prio.priority, tag: prio.tag });
      }
    }
    prioOccurrences.sort((a, b) => a.pos - b.pos);
    const hasExplicitPriority = prioOccurrences.length > 0;
    const lastPrio = hasExplicitPriority ? prioOccurrences[prioOccurrences.length - 1] : { priority: 0, tag: null };

    // 3. Find all size occurrences and their positions
    const sizeOccurrences = [];
    for (const size of this.sizes) {
      const rx = new RegExp(size.pattern.source, 'gi');
      let m;
      while ((m = rx.exec(textRaw)) !== null) {
        sizeOccurrences.push({ pos: m.index, tag: size.tag });
      }
    }
    sizeOccurrences.sort((a, b) => a.pos - b.pos);
    const hasExplicitSize = sizeOccurrences.length > 0;
    const lastSizeTag = hasExplicitSize ? sizeOccurrences[sizeOccurrences.length - 1].tag : null;

    // 4. Strip all control words, garbage, and redundant category names to get clean task title
    let cleaned = textRaw;
    for (const col of this.columns) {
      cleaned = cleaned.replace(new RegExp(col.pattern.source, 'gi'), (m, word) => m.replace(word, ' '));
    }
    for (const prio of this.priorities) {
      cleaned = cleaned.replace(new RegExp(prio.pattern.source, 'gi'), (m, word) => m.replace(word, ' '));
    }
    for (const size of this.sizes) {
      cleaned = cleaned.replace(new RegExp(size.pattern.source, 'gi'), (m, word) => m.replace(word, ' '));
    }
    for (const gPattern of this.garbageWords) {
      cleaned = cleaned.replace(new RegExp(gPattern.source, 'gi'), (m, word) => m.replace(word, ' '));
    }
    for (const cPattern of this.categoryPrefixes) {
      cleaned = cleaned.replace(new RegExp(cPattern.source, 'gi'), (m, word) => m.replace(word, ' '));
    }

    cleaned = cleanRecognizedText(cleaned);
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    if (cleaned.length > 0) {
      cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }

    const tags = [];
    if (lastPrio.tag) tags.push(lastPrio.tag);
    if (lastSizeTag) tags.push(lastSizeTag);

    return {
      title: cleaned,
      columnIdx: detectedCol,
      priority: lastPrio.priority,
      priorityTag: lastPrio.tag,
      sizeTag: lastSizeTag,
      tags: tags,
      hasExplicitPriority: hasExplicitPriority,
      hasExplicitSize: hasExplicitSize
    };
  }
};

if (typeof module !== 'undefined') {
  module.exports = { TaskParser, cleanRecognizedText };
}
