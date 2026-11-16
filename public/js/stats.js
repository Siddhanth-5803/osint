// Local forensics: every number here is computed on the device, no AI needed.

const HOUR = 3600e3;
const NEW_CONVO_GAP = 4 * HOUR;
const QUICK_REPLY = 5 * 60e3;
const REPLY_CAP = 12 * HOUR;
const READ_GAP = 6 * HOUR;

const EMOJI_RE = /\p{Extended_Pictographic}/gu;
const LAUGH_RE = /(?:\b(?:ha){2,}h?\b|\bhe(?:he)+\b|\blo+l+\b|\blmf?ao+\b|\brofl\b|😂|🤣|💀)/giu;
const URL_RE = /https?:\/\/\S+/g;

const STOP = new Set(`the and you that this for with are was have not but what all were when your can said there use each which she how their will other about out many then them these some her would make like him into time has look two more write see number way could people than first water been call who its now find long down day did get come made may part just yeah yes okay haha lol hmm also its it's i'm im dont don't thats that's know what's gonna wanna really very much too here why where they them our ours from got one going will would should could well even still only back over after before because being doing does done thing things let lets message deleted media omitted null http https www com
hai hain nahi nhi kya kyu kyun toh bhi aur yaar bhai mein main tum aap hum ham koi kuch abhi accha acha theek thik haan han nahin kar karo karna kiya kiye raha rahi rahe tha thi the hoga hogi gaya gayi apna apni mera meri tera teri uska uski unka unki yeh woh wo ye vo bas phir fir sab kab jab tab kaise kaisa kaun matlab wala wali wale lekin par pe ko se ka ki ke na`.split(/\s+/));

const pad = (n) => String(n).padStart(2, "0");
const fmtDate = (ts) => { const d = new Date(ts); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const fmtStamp = (ts) => { const d = new Date(ts); return `${fmtDate(ts)} ${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const median = (arr) => {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const top = (map, n) => [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);

export function humanDuration(ms) {
  if (ms == null) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60), rm = m % 60;
  if (h < 24) return rm ? `${h}h ${rm}m` : `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}d ${h % 24}h`;
}

export function computeStats(chat) {
  const msgs = chat.messages.filter((m) => m.author && m.type !== "system");
  const P = new Map();
  const person = (name) => {
    if (!P.has(name)) P.set(name, {
      name, messages: 0, text: 0, words: 0, chars: 0, media: 0, deleted: 0, questions: 0, emojis: 0, laughs: 0,
      night: 0, starts: 0, ends: 0, doubleRuns: 0, replyTimes: [], unanswered: 0, emojiMap: new Map(), wordMap: new Map(),
    });
    return P.get(name);
  };
  const pairs = new Map(); // "a\u0000b" -> b replying to a
  const pair = (a, b) => {
    const k = a + "\u0000" + b;
    if (!pairs.has(k)) pairs.set(k, { from: a, to: b, quick: 0, replies: 0, times: [], chars: 0 });
    return pairs.get(k);
  };
  const heat = Array.from({ length: 7 }, () => Array(24).fill(0));
  const daily = new Map();
  const groupWords = new Map();
  const groupEmoji = new Map();
  const gaps = [];

  let runLen = 0;
  for (let idx = 0; idx < msgs.length; idx++) {
    const m = msgs[idx];
    const prev = msgs[idx - 1];
    const next = msgs[idx + 1];
    const p = person(m.author);
    const d = new Date(m.ts);
    p.messages++;
    heat[(d.getDay() + 6) % 7][d.getHours()]++;
    const day = fmtDate(m.ts);
    daily.set(day, (daily.get(day) || 0) + 1);
    if (d.getHours() < 5) p.night++;

    if (m.type === "media") p.media++;
    else if (m.type === "deleted") p.deleted++;
    else {
      p.text++;
      const clean = m.text.replace(URL_RE, " ");
      const words = clean.toLowerCase().match(/[\p{L}']+/gu) || [];
      p.words += words.length;
      p.chars += m.text.length;
      if (m.text.includes("?")) p.questions++;
      for (const e of m.text.match(EMOJI_RE) || []) {
        p.emojis++;
        p.emojiMap.set(e, (p.emojiMap.get(e) || 0) + 1);
        groupEmoji.set(e, (groupEmoji.get(e) || 0) + 1);
      }
      p.laughs += (m.text.match(LAUGH_RE) || []).length;
      for (const w of words) {
        if (w.length < 3 || STOP.has(w)) continue;
        p.wordMap.set(w, (p.wordMap.get(w) || 0) + 1);
        groupWords.set(w, (groupWords.get(w) || 0) + 1);
      }
    }

    // conversations
    const gapBefore = prev ? m.ts - prev.ts : Infinity;
    if (gapBefore > NEW_CONVO_GAP) {
      p.starts++;
      if (prev) person(prev.author).ends++;
      if (prev) gaps.push({ ms: gapBefore, from: prev.ts, to: m.ts, broke: m.author });
    }

    // replies between different people
    if (prev && prev.author !== m.author && gapBefore <= REPLY_CAP) {
      p.replyTimes.push(gapBefore);
      const pr = pair(prev.author, m.author);
      pr.replies++;
      pr.times.push(gapBefore);
      pr.chars += m.text.length;
      if (gapBefore <= QUICK_REPLY) pr.quick++;
    }

    // double texting: runs of 2+ by the same author before anyone else speaks
    if (prev && prev.author === m.author && gapBefore <= NEW_CONVO_GAP) runLen++;
    else runLen = 1;
    if (runLen === 2) p.doubleRuns++;

    // left on read: last message of a run with no reply for 6h
    if (next && next.author !== m.author && next.ts - m.ts > READ_GAP) p.unanswered++;
  }

  const total = msgs.length || 1;
  const people = [...P.values()].sort((a, b) => b.messages - a.messages).map((p) => ({
    name: p.name,
    messages: p.messages,
    share: p.messages / total,
    words: p.words,
    avgWords: p.text ? p.words / p.text : 0,
    media: p.media,
    deleted: p.deleted,
    questionRate: p.text ? p.questions / p.text : 0,
    emojiRate: p.text ? p.emojis / p.text : 0,
    laughRate: p.text ? p.laughs / p.text : 0,
    nightRate: p.messages ? p.night / p.messages : 0,
    starts: p.starts,
    ends: p.ends,
    doubleTextRate: p.messages ? p.doubleRuns / p.messages : 0,
    medianReply: median(p.replyTimes),
    unansweredRate: p.messages ? p.unanswered / p.messages : 0,
    topEmojis: top(p.emojiMap, 5).map(([e]) => e),
    topWords: top(p.wordMap, 6).map(([w]) => w),
  }));

  const pairList = [...pairs.values()].map((x) => ({
    from: x.from, to: x.to, quick: x.quick, replies: x.replies,
    medianReply: median(x.times), avgChars: x.replies ? x.chars / x.replies : 0,
  })).sort((a, b) => b.quick - a.quick);

  // spike days
  const counts = [...daily.values()];
  const mean = counts.reduce((a, b) => a + b, 0) / (counts.length || 1);
  const sd = Math.sqrt(counts.reduce((a, b) => a + (b - mean) ** 2, 0) / (counts.length || 1));
  const spikes = [...daily.entries()].filter(([, c]) => c > mean + 3 * sd && c >= 20).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([day, count]) => ({ day, count }));
  const busiestDay = top(daily, 1)[0];

  let peak = { d: 0, h: 0, v: -1 };
  heat.forEach((row, d) => row.forEach((v, h) => { if (v > peak.v) peak = { d, h, v }; }));

  const first = msgs[0]?.ts, last = msgs[msgs.length - 1]?.ts;
  const stats = {
    source: chat.source,
    title: chat.title,
    totalMessages: msgs.length,
    range: first ? { from: fmtDate(first), to: fmtDate(last), days: Math.max(1, Math.round((last - first) / 86400e3)) } : null,
    people,
    pairs: pairList,
    heat,
    peak: { day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][peak.d], hour: peak.h, count: peak.v },
    busiestDay: busiestDay ? { day: busiestDay[0], count: busiestDay[1] } : null,
    spikes,
    silences: gaps.sort((a, b) => b.ms - a.ms).slice(0, 3).map((g) => ({ ms: g.ms, from: fmtDate(g.from), to: fmtDate(g.to), brokenBy: g.broke })),
    topWords: top(groupWords, 18).map(([w, c]) => ({ w, c })),
    topEmojis: top(groupEmoji, 10).map(([e, c]) => ({ e, c })),
  };
  stats.badges = assignBadges(stats);
  if (people.length === 2) stats.interest = interestMeter(stats);
  return stats;
}

const BADGES = [
  { id: "yapper", emoji: "📢", title: "Yapper-in-Chief", pick: (p) => p.messages, desc: (p) => `${Math.round(p.share * 100)}% of all messages. Has never had an unspoken thought.` },
  { id: "ghost", emoji: "👻", title: "The Ghost", pick: (p) => -p.messages, min: 3, desc: (p) => `Only ${Math.round(p.share * 100)}% of messages. Reads everything. Says nothing.` },
  { id: "owl", emoji: "🦉", title: "Certified Night Owl", pick: (p) => p.nightRate, desc: (p) => `${Math.round(p.nightRate * 100)}% of their texts land between midnight and 5 a.m.` },
  { id: "double", emoji: "📨", title: "Double-Text Champion", pick: (p) => p.doubleTextRate, desc: () => "Will send four messages before you finish reading the first." },
  { id: "speed", emoji: "⚡", title: "Speed Demon", pick: (p) => (p.medianReply == null ? -Infinity : -p.medianReply), desc: (p) => `Median reply in ${humanDuration(p.medianReply)}. Phone is surgically attached.` },
  { id: "slow", emoji: "🐢", title: "Takes Their Sweet Time", pick: (p) => p.medianReply ?? -Infinity, desc: (p) => `Median reply in ${humanDuration(p.medianReply)}. Replies like a government office.` },
  { id: "starter", emoji: "🔥", title: "Conversation Starter", pick: (p) => p.starts, desc: (p) => `Revived the chat ${p.starts} times after it went quiet.` },
  { id: "killer", emoji: "🪦", title: "Conversation Killer", pick: (p) => p.ends, desc: (p) => `Sent the last message before silence ${p.ends} times.` },
  { id: "essay", emoji: "📜", title: "Essay Writer", pick: (p) => p.avgWords, desc: (p) => `${p.avgWords.toFixed(1)} words per message. Every text is a TED talk.` },
  { id: "memes", emoji: "🐸", title: "Meme Dealer", pick: (p) => p.media, desc: (p) => `${p.media} photos, stickers and videos supplied.` },
  { id: "emoji", emoji: "🤡", title: "Emoji Abuser", pick: (p) => p.emojiRate, desc: (p) => `${p.emojiRate.toFixed(1)} emojis per message. Favourite: ${p.topEmojis[0] || "?"}` },
  { id: "deleter", emoji: "🗑️", title: "The Deleter", pick: (p) => p.deleted, need: (p) => p.deleted > 0, desc: (p) => `Deleted ${p.deleted} messages. We saw. We always see.` },
  { id: "curious", emoji: "❓", title: "Question Machine", pick: (p) => p.questionRate, desc: (p) => `${Math.round(p.questionRate * 100)}% of their texts are questions. Nobody answers.` },
  { id: "laugh", emoji: "😂", title: "Laugh Track", pick: (p) => p.laughRate, need: (p) => p.laughRate > 0, desc: () => "Laughs at everything. Some of it was even funny." },
  { id: "ignored", emoji: "📭", title: "Left-on-Read Survivor", pick: (p) => p.unansweredRate, need: (p) => p.unansweredRate > 0, desc: (p) => `${Math.round(p.unansweredRate * 100)}% of their messages got no reply for 6+ hours.` },
];

function assignBadges(stats) {
  const eligible = stats.people.filter((p) => p.messages >= 10);
  if (!eligible.length) return [];
  const out = [];
  for (const b of BADGES) {
    if (b.min && eligible.length < b.min) continue;
    const pool = eligible.filter((p) => (b.need ? b.need(p) : true));
    if (!pool.length) continue;
    const winner = pool.reduce((best, p) => (b.pick(p) > b.pick(best) ? p : best));
    if (!Number.isFinite(b.pick(winner))) continue;
    out.push({ id: b.id, emoji: b.emoji, title: b.title, winner: winner.name, desc: b.desc(winner) });
  }
  // Keep the yapper and the speed/slow pair apart: don't give the same person opposite badges.
  return out.filter((b, i, arr) => !(b.id === "slow" && arr.find((x) => x.id === "speed")?.winner === b.winner));
}

// One-on-one: who's more into whom (0-100 for person A).
function interestMeter(stats) {
  const [a, b] = stats.people;
  const ab = stats.pairs.find((x) => x.from === b.name && x.to === a.name); // a replying to b
  const ba = stats.pairs.find((x) => x.from === a.name && x.to === b.name);
  const signals = [];
  const ratio = (x, y) => (x + y ? x / (x + y) : 0.5);
  signals.push(ratio(a.messages, b.messages));
  signals.push(ratio(a.starts, b.starts));
  signals.push(ratio(a.avgWords, b.avgWords));
  signals.push(ratio(a.doubleTextRate, b.doubleTextRate));
  if (ab?.medianReply != null && ba?.medianReply != null) signals.push(ratio(ba.medianReply, ab.medianReply)); // faster reply = more interest
  const score = Math.round((signals.reduce((s, x) => s + x, 0) / signals.length) * 100);
  return { a: a.name, b: b.name, aScore: score, bScore: 100 - score, aReply: ab?.medianReply ?? null, bReply: ba?.medianReply ?? null };
}

// Compact stats for the AI (names already swapped when anonymised).
export function statsForAi(stats, rename = (n) => n) {
  const r2 = (x) => Math.round(x * 100) / 100;
  return {
    title: stats.title,
    source: stats.source,
    total_messages: stats.totalMessages,
    range: stats.range,
    people: stats.people.slice(0, 20).map((p) => ({
      name: rename(p.name), messages: p.messages, share: r2(p.share), avg_words: r2(p.avgWords), media: p.media, deleted: p.deleted,
      question_rate: r2(p.questionRate), emoji_rate: r2(p.emojiRate), laugh_rate: r2(p.laughRate), night_rate: r2(p.nightRate),
      convo_starts: p.starts, convo_ends: p.ends, double_text_rate: r2(p.doubleTextRate), median_reply: humanDuration(p.medianReply),
      left_on_read_rate: r2(p.unansweredRate), top_emojis: p.topEmojis, top_words: p.topWords,
    })),
    pairs: stats.pairs.slice(0, 30).map((x) => ({
      replier: rename(x.to), replying_to: rename(x.from), quick_replies: x.quick, replies: x.replies,
      median_reply: humanDuration(x.medianReply), avg_reply_chars: Math.round(x.avgChars),
    })),
    peak_time: stats.peak,
    busiest_day: stats.busiestDay,
    spike_days: stats.spikes,
    longest_silences: stats.silences.map((s) => ({ ...s, ms: undefined, length: humanDuration(s.ms), brokenBy: rename(s.brokenBy) })),
    group_top_words: stats.topWords.map((x) => x.w),
    group_top_emojis: stats.topEmojis.map((x) => x.e),
    one_on_one_interest: stats.interest ? { [rename(stats.interest.a)]: stats.interest.aScore, [rename(stats.interest.b)]: stats.interest.bScore } : undefined,
  };
}

// Anonymiser: names -> "Suspect A", "Suspect B"... and back again.
export function makeNameMap(people) {
  const forward = new Map();
  const back = new Map();
  people.forEach((p, i) => {
    const code = i < 26 ? String.fromCharCode(65 + i) : String.fromCharCode(65 + Math.floor(i / 26) - 1) + String.fromCharCode(65 + (i % 26));
    forward.set(p.name, `Suspect ${code}`);
    back.set(`Suspect ${code}`, p.name);
  });
  const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Replace full names and first names (3+ letters) inside message text too.
  const variants = [];
  for (const [name, code] of forward) {
    variants.push([name, code]);
    const firstName = name.split(/\s+/)[0];
    if (firstName.length >= 3 && firstName !== name && !people.some((p) => p.name !== name && p.name.split(/\s+/)[0] === firstName)) variants.push([firstName, code]);
  }
  variants.sort((a, b) => b[0].length - a[0].length);
  const textRe = variants.length ? new RegExp(`(?<![\\p{L}\\p{N}])(${variants.map(([v]) => escape(v)).join("|")})(?![\\p{L}\\p{N}])`, "giu") : null;
  const lookup = new Map(variants.map(([v, c]) => [v.toLowerCase(), c]));
  return {
    name: (n) => forward.get(n) || n,
    text: (t) => (textRe ? t.replace(textRe, (m) => lookup.get(m.toLowerCase()) || m) : t),
    restore: (t) => (typeof t === "string" ? t.replace(/Suspect ([A-Z]{1,2})\b/g, (m) => back.get(m) || m) : t),
  };
}

export function restoreDeep(value, restore) {
  if (typeof value === "string") return restore(value);
  if (Array.isArray(value)) return value.map((v) => restoreDeep(v, restore));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, restoreDeep(v, restore)]));
  return value;
}

const scrub = (t) => t.replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "<email>").replace(/\+?\d[\d\s-]{8,}\d/g, "<number>");

// Picks a representative sample of the chat that fits the budget (characters).
export function buildTranscript(chat, stats, { anon = null, budget = 150_000 } = {}) {
  const msgs = chat.messages.filter((m) => m.author && m.type !== "system");
  const line = (m) => {
    const who = anon ? anon.name(m.author) : m.author;
    let body = m.type === "media" ? "<media>" : m.type === "deleted" ? "<deleted message>" : scrub(m.text).slice(0, 500).replace(/\n/g, " / ");
    if (anon && m.type === "text") body = anon.text(body);
    return `#${m.i} [${fmtStamp(m.ts)}] ${who}: ${body}`;
  };
  const lines = msgs.map(line);
  const n = lines.length;
  const keep = new Uint8Array(n);
  let used = 0;
  const add = (i) => { if (i >= 0 && i < n && !keep[i] && used + lines[i].length + 1 <= budget) { keep[i] = 1; used += lines[i].length + 1; } };

  for (let i = 0; i < Math.min(250, n); i++) add(i);
  for (let i = Math.max(0, n - 250); i < n; i++) add(i);
  const spikeDays = new Set(stats.spikes.slice(0, 3).map((s) => s.day));
  let perDay = new Map();
  msgs.forEach((m, i) => {
    const d = fmtDate(m.ts);
    if (spikeDays.has(d) && (perDay.get(d) || 0) < 300) { perDay.set(d, (perDay.get(d) || 0) + 1); add(i); }
  });
  // evenly spaced windows of 40 messages
  const windowSize = 40;
  for (let step = Math.max(windowSize * 2, Math.floor(n / 8)); step >= windowSize && used < budget * 0.97; step = Math.floor(step / 2)) {
    for (let start = 0; start < n && used < budget * 0.97; start += step) {
      for (let i = start; i < start + windowSize; i++) add(i);
    }
  }

  const out = [];
  let skipped = 0;
  for (let i = 0; i < n; i++) {
    if (keep[i]) {
      if (skipped) out.push(`... [${skipped} messages skipped] ...`);
      skipped = 0;
      out.push(lines[i]);
    } else skipped++;
  }
  if (skipped) out.push(`... [${skipped} messages skipped] ...`);
  return out.join("\n");
}
