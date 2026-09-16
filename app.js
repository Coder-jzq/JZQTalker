const ORAL_DATA_PATHS = [
  "../data/uk_visiting_phd_daily_english_500.json",
  "/data/uk_visiting_phd_daily_english_500.json",
  "./data/uk_visiting_phd_daily_english_500.json"
];

const PAPER_DATA_PATHS = [
  "../data/paper_learning_expressions.json",
  "/data/paper_learning_expressions.json",
  "./data/paper_learning_expressions.json"
];

const PROGRESS_KEY = "english-study-desk-progress-v1";
const THEME_KEY = "english-study-desk-theme-v1";
const THEMES = ["pink", "light", "eye"];
const VIEW_TITLES = {
  oral: "口语背诵",
  dialogue: "对话回答",
  papers: "论文表达"
};

const state = {
  view: "oral",
  oral: null,
  paperBank: null,
  sentences: [],
  dialogues: [],
  papers: [],
  search: "",
  category: "all",
  dialogueId: "",
  paperId: "",
  sentenceLimit: 24,
  dialoguePairIndex: 0,
  answerVisible: false,
  hintVisible: false,
  dialogueFeedback: null,
  shuffledSentences: false,
  voices: [],
  progress: loadProgress()
};

const nodes = {
  statusLine: document.querySelector("#statusLine"),
  viewTitle: document.querySelector("#viewTitle"),
  sentenceCount: document.querySelector("#sentenceCount"),
  dialogueCount: document.querySelector("#dialogueCount"),
  paperCount: document.querySelector("#paperCount"),
  savedCount: document.querySelector("#savedCount"),
  voiceSelect: document.querySelector("#voiceSelect"),
  rateControl: document.querySelector("#rateControl"),
  rateValue: document.querySelector("#rateValue"),
  stopSpeechBtn: document.querySelector("#stopSpeechBtn"),
  themeOptions: document.querySelectorAll(".theme-option"),
  tabs: document.querySelectorAll(".tab"),
  controls: document.querySelectorAll("[data-control]"),
  searchInput: document.querySelector("#searchInput"),
  categorySelect: document.querySelector("#categorySelect"),
  dialogueSelect: document.querySelector("#dialogueSelect"),
  paperSelect: document.querySelector("#paperSelect"),
  shuffleBtn: document.querySelector("#shuffleBtn"),
  loadMoreBtn: document.querySelector("#loadMoreBtn"),
  oralView: document.querySelector("#oralView"),
  dialogueView: document.querySelector("#dialogueView"),
  paperView: document.querySelector("#paperView"),
  sentenceGrid: document.querySelector("#sentenceGrid"),
  sentenceTemplate: document.querySelector("#sentenceCardTemplate"),
  dialogueTitle: document.querySelector("#dialogueTitle"),
  promptBox: document.querySelector("#promptBox"),
  replyInput: document.querySelector("#replyInput"),
  checkReplyBtn: document.querySelector("#checkReplyBtn"),
  hintReplyBtn: document.querySelector("#hintReplyBtn"),
  revealReplyBtn: document.querySelector("#revealReplyBtn"),
  nextTurnBtn: document.querySelector("#nextTurnBtn"),
  speakPromptBtn: document.querySelector("#speakPromptBtn"),
  speakMineBtn: document.querySelector("#speakMineBtn"),
  speakDialogueBtn: document.querySelector("#speakDialogueBtn"),
  feedbackBox: document.querySelector("#feedbackBox"),
  answerBox: document.querySelector("#answerBox"),
  dialogueTranscript: document.querySelector("#dialogueTranscript"),
  paperList: document.querySelector("#paperList"),
  paperDetail: document.querySelector("#paperDetail")
};

init();

async function init() {
  setupTheme();
  bindEvents();
  setupVoices();

  try {
    const { oral, paperBank, source } = await loadStudyData();

    state.oral = oral;
    state.paperBank = paperBank;
    state.sentences = flattenSentences(oral);
    state.dialogues = oral.dialogues || [];
    state.papers = paperBank.papers || [];
    state.dialogueId = state.dialogues[0]?.dialogue_id || "";
    state.paperId = state.papers[0]?.id || "";

    populateCategorySelect();
    populateDialogueSelect();
    populatePaperSelect();
    updateStats();
    setStatus(
      `${source} · ${state.sentences.length} 个口语句子、${state.dialogues.length} 段对话、${state.papers.length} 篇论文`
    );
    render();
  } catch (error) {
    setStatus("数据读取失败，请刷新页面或从当前目录启动静态服务器。");
    nodes.sentenceGrid.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}

async function loadStudyData() {
  const [oralResult, paperResult] = await Promise.allSettled([
    fetchJson(ORAL_DATA_PATHS),
    fetchJson(PAPER_DATA_PATHS)
  ]);
  const embedded = window.LEARNING_SITE_DATA || {};
  const oral = oralResult.status === "fulfilled" ? oralResult.value : embedded.oral;
  const paperBank = paperResult.status === "fulfilled" ? paperResult.value : embedded.paperBank;

  if (oral && paperBank) {
    const source =
      oralResult.status === "fulfilled" && paperResult.status === "fulfilled"
        ? "已读取 data 文件"
        : "已读取内嵌数据";
    return { oral, paperBank, source };
  }

  const failures = [oralResult, paperResult]
    .filter((result) => result.status === "rejected")
    .map((result) => result.reason?.message)
    .filter(Boolean);
  throw new Error(failures.join(" | ") || "缺少学习数据");
}

async function fetchJson(paths) {
  const failures = [];

  for (const path of paths) {
    try {
      const response = await fetch(path, { cache: "no-store" });
      if (!response.ok) {
        failures.push(`${path}: ${response.status}`);
        continue;
      }
      return await response.json();
    } catch (error) {
      failures.push(`${path}: ${error.message}`);
    }
  }

  throw new Error(failures.join(" | "));
}

function bindEvents() {
  for (const option of nodes.themeOptions) {
    option.addEventListener("click", () => {
      applyTheme(option.dataset.themeOption);
    });
  }

  for (const tab of nodes.tabs) {
    tab.addEventListener("click", () => {
      setView(tab.dataset.view);
    });
  }

  nodes.searchInput.addEventListener("input", () => {
    state.search = nodes.searchInput.value.trim();
    state.sentenceLimit = 24;
    render();
  });

  nodes.categorySelect.addEventListener("change", () => {
    state.category = nodes.categorySelect.value;
    state.sentenceLimit = 24;
    renderOral();
  });

  nodes.dialogueSelect.addEventListener("change", () => {
    state.dialogueId = nodes.dialogueSelect.value;
    state.dialoguePairIndex = 0;
    state.answerVisible = false;
    state.hintVisible = false;
    state.dialogueFeedback = null;
    nodes.replyInput.value = "";
    renderDialogue();
  });

  nodes.paperSelect.addEventListener("change", () => {
    state.paperId = nodes.paperSelect.value;
    renderPapers();
  });

  nodes.shuffleBtn.addEventListener("click", () => {
    if (state.view === "oral") {
      state.shuffledSentences = !state.shuffledSentences;
      state.sentenceLimit = 24;
      renderOral();
      return;
    }

    if (state.view === "dialogue" && state.dialogues.length) {
      const index = Math.floor(Math.random() * state.dialogues.length);
      state.dialogueId = state.dialogues[index].dialogue_id;
      state.dialoguePairIndex = 0;
      state.answerVisible = false;
      state.hintVisible = false;
      state.dialogueFeedback = null;
      nodes.dialogueSelect.value = state.dialogueId;
      nodes.replyInput.value = "";
      renderDialogue();
      return;
    }

    if (state.view === "papers" && state.papers.length) {
      const index = Math.floor(Math.random() * state.papers.length);
      state.paperId = state.papers[index].id;
      nodes.paperSelect.value = state.paperId;
      renderPapers();
    }
  });

  nodes.loadMoreBtn.addEventListener("click", () => {
    state.sentenceLimit += 24;
    renderOral();
  });

  nodes.replyInput.addEventListener("input", () => {
    state.dialogueFeedback = null;
    renderDialogueFeedback();
  });

  nodes.checkReplyBtn.addEventListener("click", () => {
    const pair = activeDialoguePair();
    state.dialogueFeedback = evaluateDialogueReply(nodes.replyInput.value, pair.reply?.en);
    rememberDialogueAttempt(state.dialogueFeedback);
    renderDialogueFeedback();
  });

  nodes.hintReplyBtn.addEventListener("click", () => {
    state.hintVisible = !state.hintVisible;
    renderDialogue();
  });

  nodes.revealReplyBtn.addEventListener("click", () => {
    state.answerVisible = true;
    state.hintVisible = false;
    renderDialogue();
    const pair = activeDialoguePair();
    if (pair.reply) speakText(pair.reply.en);
  });

  nodes.nextTurnBtn.addEventListener("click", () => {
    const dialogue = activeDialogue();
    if (!dialogue) return;
    const nextIndex = state.dialoguePairIndex + 2;
    state.dialoguePairIndex = nextIndex < dialogue.turns.length - 1 ? nextIndex : 0;
    state.answerVisible = false;
    state.hintVisible = false;
    state.dialogueFeedback = null;
    nodes.replyInput.value = "";
    renderDialogue();
  });

  nodes.speakPromptBtn.addEventListener("click", () => {
    const pair = activeDialoguePair();
    if (pair.prompt) speakText(pair.prompt.en);
  });

  nodes.speakMineBtn.addEventListener("click", () => {
    speakText(nodes.replyInput.value);
  });

  nodes.speakDialogueBtn.addEventListener("click", () => {
    const dialogue = activeDialogue();
    if (!dialogue) return;
    speakLines(dialogue.turns.map((turn) => turn.en));
  });

  nodes.stopSpeechBtn.addEventListener("click", () => {
    stopSpeech();
  });

  nodes.rateControl.addEventListener("input", () => {
    nodes.rateValue.textContent = Number(nodes.rateControl.value).toFixed(2);
  });
}

function setupTheme() {
  let saved = "pink";
  try {
    saved = localStorage.getItem(THEME_KEY) || "pink";
  } catch {
    saved = "pink";
  }
  applyTheme(saved, { persist: false });
}

function applyTheme(theme, options = {}) {
  const nextTheme = THEMES.includes(theme) ? theme : "pink";
  document.body.dataset.theme = nextTheme;

  for (const option of nodes.themeOptions) {
    const active = option.dataset.themeOption === nextTheme;
    option.classList.toggle("active", active);
    option.setAttribute("aria-checked", String(active));
  }

  if (options.persist === false) return;
  try {
    localStorage.setItem(THEME_KEY, nextTheme);
  } catch {
    setStatus("当前浏览器未保存主题选择");
  }
}

function setView(view) {
  state.view = VIEW_TITLES[view] ? view : "oral";
  nodes.viewTitle.textContent = VIEW_TITLES[state.view];

  for (const tab of nodes.tabs) {
    tab.classList.toggle("active", tab.dataset.view === state.view);
  }

  nodes.oralView.classList.toggle("hidden", state.view !== "oral");
  nodes.dialogueView.classList.toggle("hidden", state.view !== "dialogue");
  nodes.paperView.classList.toggle("hidden", state.view !== "papers");

  for (const control of nodes.controls) {
    control.classList.toggle("hidden", control.dataset.control !== state.view);
  }

  render();
}

function render() {
  for (const control of nodes.controls) {
    control.classList.toggle("hidden", control.dataset.control !== state.view);
  }

  if (state.view === "oral") renderOral();
  if (state.view === "dialogue") renderDialogue();
  if (state.view === "papers") renderPapers();
}

function flattenSentences(data) {
  return (data.base_sentences?.categories || []).flatMap((category) =>
    (category.sentences || []).map((sentence) => ({
      ...sentence,
      category_id: category.category_id,
      category_zh: category.name_zh,
      category_en: category.name_en
    }))
  );
}

function populateCategorySelect() {
  const categories = state.oral.base_sentences?.categories || [];
  nodes.categorySelect.innerHTML = [
    `<option value="all">全部场景</option>`,
    ...categories.map(
      (category) =>
        `<option value="${escapeAttr(category.category_id)}">${escapeHtml(
          category.name_zh
        )} / ${escapeHtml(category.name_en)}</option>`
    )
  ].join("");
}

function populateDialogueSelect() {
  nodes.dialogueSelect.innerHTML = state.dialogues
    .map(
      (dialogue) =>
        `<option value="${escapeAttr(dialogue.dialogue_id)}">${escapeHtml(
          dialogue.dialogue_id
        )} · ${escapeHtml(dialogue.title_zh)} / ${escapeHtml(
          dialogue.title_en
        )}</option>`
    )
    .join("");
}

function populatePaperSelect() {
  nodes.paperSelect.innerHTML = state.papers
    .map(
      (paper) =>
        `<option value="${escapeAttr(paper.id)}">${escapeHtml(
          paper.short_title
        )} · ${escapeHtml(paper.year)}</option>`
    )
    .join("");
}

function renderOral() {
  const items = filteredSentences();
  const visibleItems = items.slice(0, state.sentenceLimit);

  nodes.loadMoreBtn.disabled = visibleItems.length >= items.length;
  nodes.loadMoreBtn.textContent =
    visibleItems.length >= items.length ? "Done" : `More (${items.length - visibleItems.length})`;

  if (!visibleItems.length) {
    nodes.sentenceGrid.innerHTML = `<div class="empty">没有匹配的口语句子</div>`;
    return;
  }

  nodes.sentenceGrid.innerHTML = "";

  for (const item of visibleItems) {
    const fragment = nodes.sentenceTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".study-card");
    const tag = fragment.querySelector(".tag");
    const english = fragment.querySelector(".english");
    const chinese = fragment.querySelector(".chinese");
    const speakBtn = fragment.querySelector(".speak");
    const rememberBtn = fragment.querySelector(".remember");

    tag.textContent = item.category_zh;
    english.textContent = item.en;
    chinese.textContent = item.zh;
    speakBtn.addEventListener("click", () => speakText(item.en));
    rememberBtn.classList.toggle("is-saved", Boolean(state.progress.sentences[item.id]));
    rememberBtn.textContent = state.progress.sentences[item.id] ? "Remembered" : "Remember";
    rememberBtn.addEventListener("click", () => {
      toggleRemember(item.id);
      rememberBtn.classList.toggle("is-saved", Boolean(state.progress.sentences[item.id]));
      rememberBtn.textContent = state.progress.sentences[item.id] ? "Remembered" : "Remember";
      updateStats();
    });

    card.dataset.id = item.id;
    nodes.sentenceGrid.appendChild(fragment);
  }
}

function filteredSentences() {
  let items = state.sentences.filter((item) => {
    if (state.category !== "all" && item.category_id !== state.category) return false;
    if (!state.search) return true;
    return searchableText(item).includes(normalize(state.search));
  });

  if (state.shuffledSentences) {
    items = [...items].sort(() => Math.random() - 0.5);
  }

  return items;
}

function renderDialogue() {
  const dialogue = activeDialogue();
  if (!dialogue) {
    nodes.promptBox.innerHTML = `<div class="empty">没有可用对话</div>`;
    return;
  }

  nodes.dialogueTitle.textContent = `${dialogue.title_zh} / ${dialogue.title_en}`;
  const pair = activeDialoguePair();

  nodes.promptBox.innerHTML = pair.prompt
    ? `
      <span class="tag">Speaker ${escapeHtml(pair.prompt.speaker)}</span>
      <p class="english">${escapeHtml(pair.prompt.en)}</p>
      <p class="chinese">${escapeHtml(pair.prompt.zh)}</p>
    `
    : `<div class="empty">这段对话没有可练习的下一轮</div>`;

  nodes.answerBox.innerHTML =
    state.answerVisible && pair.reply
      ? `
        <span class="tag">Expected reply · Speaker ${escapeHtml(pair.reply.speaker)}</span>
        <p class="english">${escapeHtml(pair.reply.en)}</p>
        <p class="chinese">${escapeHtml(pair.reply.zh)}</p>
      `
      : state.hintVisible && pair.reply
        ? `
          <span class="tag">Hint</span>
          <p class="english">${escapeHtml(makeReplyHint(pair.reply.en))}</p>
          <p class="chinese">先尝试表达核心意思，再点击 Check 检查。</p>
        `
      : `<p>Expected reply is hidden.</p>`;

  nodes.dialogueTranscript.innerHTML = dialogue.turns
    .map(
      (turn) => `
        <div class="turn">
          <span class="speaker">${escapeHtml(turn.speaker)}</span>
          <div class="turn-text">
            <strong>${escapeHtml(turn.en)}</strong>
            <span>${escapeHtml(turn.zh)}</span>
          </div>
          <button class="mini-button" type="button" data-speak="${escapeAttr(turn.en)}">Listen</button>
        </div>
      `
    )
    .join("");

  for (const button of nodes.dialogueTranscript.querySelectorAll("[data-speak]")) {
    button.addEventListener("click", () => speakText(button.dataset.speak));
  }

  renderDialogueFeedback();
}

function activeDialogue() {
  return (
    state.dialogues.find((dialogue) => dialogue.dialogue_id === state.dialogueId) ||
    state.dialogues[0]
  );
}

function activeDialoguePair() {
  const dialogue = activeDialogue();
  if (!dialogue) return { prompt: null, reply: null };
  const prompt = dialogue.turns[state.dialoguePairIndex] || dialogue.turns[0];
  const reply = dialogue.turns[state.dialoguePairIndex + 1] || null;
  return { prompt, reply };
}

function renderDialogueFeedback() {
  const feedback = state.dialogueFeedback;

  if (!feedback) {
    nodes.feedbackBox.innerHTML = `
      <p class="feedback-placeholder">输入你的回答后点击 Check。系统会按参考答案做离线反馈，适合背诵和句型训练。</p>
    `;
    return;
  }

  nodes.feedbackBox.innerHTML = `
    <div class="feedback-topline">
      <div>
        <span class="tag">${escapeHtml(feedback.level)}</span>
        <strong>${escapeHtml(feedback.title)}</strong>
      </div>
      <span class="score-pill">${feedback.score}/100</span>
    </div>
    <div class="score-bar" style="--score: ${feedback.score}%"><span></span></div>
    <p>${escapeHtml(feedback.summary)}</p>
    ${
      feedback.missingKeywords.length
        ? `<p><strong>建议补上的关键词：</strong>${feedback.missingKeywords
            .map((word) => `<span class="hint-word">${escapeHtml(word)}</span>`)
            .join("")}</p>`
        : `<p><strong>关键词覆盖：</strong>核心意思已经比较完整。</p>`
    }
    <ul>
      ${feedback.notes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}
    </ul>
    <div class="polish-box">
      <span>Natural reply</span>
      <p class="english">${escapeHtml(feedback.polished)}</p>
      <button class="mini-button" type="button" data-speak="${escapeAttr(feedback.polished)}">Listen</button>
    </div>
  `;

  const listenButton = nodes.feedbackBox.querySelector("[data-speak]");
  listenButton?.addEventListener("click", () => speakText(listenButton.dataset.speak));
}

function evaluateDialogueReply(userAnswer, expectedAnswer) {
  const user = String(userAnswer || "").trim();
  const expected = String(expectedAnswer || "").trim();

  if (!expected) {
    return {
      score: 0,
      level: "No target",
      title: "当前轮次没有参考回答",
      summary: "请选择下一段对话或点击 Next。",
      missingKeywords: [],
      notes: ["这一步没有可比较的目标句。"],
      polished: ""
    };
  }

  if (!user) {
    const keywords = keywordTokens(expected).slice(0, 5);
    return {
      score: 0,
      level: "Empty",
      title: "还没有输入回答",
      summary: "先用英文写一句自己的回答，再点击 Check。",
      missingKeywords: keywords,
      notes: ["不用完全照抄参考答案，但需要覆盖主要意思。"],
      polished: expected
    };
  }

  const userTokens = tokenizeForFeedback(user);
  const expectedTokens = tokenizeForFeedback(expected);
  const userSet = new Set(userTokens);
  const expectedSet = new Set(expectedTokens);
  const keywordList = keywordTokens(expected);
  const allMissingKeywords = keywordList.filter((word) => !userSet.has(word));
  const missingKeywords = allMissingKeywords.slice(0, 6);
  const sharedCount = [...expectedSet].filter((word) => userSet.has(word)).length;
  const dice =
    expectedSet.size + userSet.size > 0 ? (2 * sharedCount) / (expectedSet.size + userSet.size) : 0;
  const sequence = expectedTokens.length
    ? longestCommonSubsequenceLength(userTokens, expectedTokens) / expectedTokens.length
    : 0;
  const keywordCoverage = keywordList.length
    ? (keywordList.length - allMissingKeywords.length) / keywordList.length
    : dice;
  const normalizedUser = normalizeForFeedback(user);
  const normalizedExpected = normalizeForFeedback(expected);
  const rawScore =
    normalizedUser === normalizedExpected
      ? 100
      : Math.round((dice * 0.42 + sequence * 0.34 + keywordCoverage * 0.24) * 100);
  const score = Math.max(0, Math.min(100, rawScore));
  const notes = [];

  if (score >= 85) {
    notes.push("你的回答和参考表达非常接近，可以重点练语音和连读。");
  } else if (score >= 65) {
    notes.push("核心意思基本到位，可以再补齐参考答案里的自然搭配。");
  } else if (score >= 40) {
    notes.push("已经覆盖了部分意思，但还需要补足关键词和固定表达。");
  } else {
    notes.push("建议先听一遍参考答案，再跟读并重新输入。");
  }

  if (missingKeywords.length) {
    notes.push("优先补上缺失关键词，而不是逐词翻译中文。");
  }

  if (userTokens.length <= 2 && expectedTokens.length > 3) {
    notes.push("你的回答偏短，真实对话里可以再加一个完整谓语或补充信息。");
  }

  if (sequence < 0.5 && score < 85) {
    notes.push("语序和参考表达差异较大，可以模仿参考句的结构。");
  }

  return {
    score,
    level: score >= 85 ? "Strong" : score >= 65 ? "Close" : score >= 40 ? "Partial" : "Retry",
    title:
      score >= 85
        ? "回答很接近参考表达"
        : score >= 65
          ? "意思基本接近"
          : score >= 40
            ? "有部分关键词"
            : "建议重练这一句",
    summary: `参考答案：${expected}`,
    missingKeywords,
    notes,
    polished: expected
  };
}

function rememberDialogueAttempt(feedback) {
  if (!feedback) return;
  const dialogue = activeDialogue();
  const pair = activeDialoguePair();
  if (!dialogue || !pair.prompt) return;

  if (!state.progress.dialogues) state.progress.dialogues = {};
  state.progress.dialogues[`${dialogue.dialogue_id}:${pair.prompt.turn}`] = {
    score: feedback.score,
    updated_at: new Date().toISOString()
  };
  saveProgress();
}

function makeReplyHint(answer) {
  const keywords = keywordTokens(answer).slice(0, 4);
  if (!keywords.length) return "Try to answer naturally in one short sentence.";
  return `Try to include: ${keywords.join(", ")}`;
}

function keywordTokens(text) {
  const stopWords = new Set([
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "but",
    "by",
    "can",
    "do",
    "for",
    "from",
    "i",
    "in",
    "is",
    "it",
    "me",
    "my",
    "of",
    "on",
    "or",
    "so",
    "that",
    "the",
    "this",
    "to",
    "we",
    "you"
  ]);

  return tokenizeForFeedback(text).filter((word) => word.length > 2 && !stopWords.has(word));
}

function tokenizeForFeedback(text) {
  return normalizeForFeedback(text).split(" ").filter(Boolean);
}

function normalizeForFeedback(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/\bi'm\b/g, "i am")
    .replace(/\byou're\b/g, "you are")
    .replace(/\bwe're\b/g, "we are")
    .replace(/\bthey're\b/g, "they are")
    .replace(/\bit's\b/g, "it is")
    .replace(/\bthat's\b/g, "that is")
    .replace(/\bcan't\b/g, "cannot")
    .replace(/\bwon't\b/g, "will not")
    .replace(/n't\b/g, " not")
    .replace(/'ll\b/g, " will")
    .replace(/'d\b/g, " would")
    .replace(/'ve\b/g, " have")
    .replace(/'re\b/g, " are")
    .replace(/'s\b/g, " is")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function longestCommonSubsequenceLength(left, right) {
  const previous = new Array(right.length + 1).fill(0);
  const current = new Array(right.length + 1).fill(0);

  for (const leftToken of left) {
    for (let index = 0; index < right.length; index += 1) {
      current[index + 1] =
        leftToken === right[index]
          ? previous[index] + 1
          : Math.max(previous[index + 1], current[index]);
    }
    previous.splice(0, previous.length, ...current);
    current.fill(0);
  }

  return previous[right.length];
}

function renderPapers() {
  const papers = filteredPapers();
  const activePaper = papers.find((paper) => paper.id === state.paperId) || papers[0] || null;
  if (activePaper) state.paperId = activePaper.id;

  nodes.paperList.innerHTML = papers.length
    ? papers
        .map(
          (paper) => `
            <button class="paper-row ${paper.id === state.paperId ? "active" : ""}" type="button" data-paper-id="${escapeAttr(
              paper.id
            )}">
              <strong>${escapeHtml(paper.short_title)}</strong>
              <span>${escapeHtml(paper.venue)}</span>
              <span>${escapeHtml(paper.title)}</span>
            </button>
          `
        )
        .join("")
    : `<div class="empty">没有匹配的论文</div>`;

  for (const button of nodes.paperList.querySelectorAll("[data-paper-id]")) {
    button.addEventListener("click", () => {
      state.paperId = button.dataset.paperId;
      nodes.paperSelect.value = state.paperId;
      renderPapers();
    });
  }

  nodes.paperDetail.innerHTML = activePaper
    ? paperDetailHtml(activePaper)
    : `<div class="empty">没有匹配的论文表达</div>`;

  for (const button of nodes.paperDetail.querySelectorAll("[data-speak]")) {
    button.addEventListener("click", () => speakText(button.dataset.speak));
  }
}

function filteredPapers() {
  if (!state.search) return state.papers;
  const query = normalize(state.search);
  return state.papers.filter((paper) => searchableText(paper).includes(query));
}

function paperDetailHtml(paper) {
  const flow = paper.meeting_flow || {};
  const metrics = flow.metrics || [];
  const general = state.paperBank?.general_academic_expressions || [];

  return `
    <div class="paper-title-row">
      <div>
        <p class="eyebrow">${escapeHtml(paper.short_title)}</p>
        <h2>${escapeHtml(paper.title)}</h2>
      </div>
      <button class="primary-action" type="button" data-speak="${escapeAttr(
        paper.english_presentation?.[0]?.en || paper.title
      )}">Listen</button>
    </div>

    <p class="paper-meta">
      ${escapeHtml(paper.venue)} · ${escapeHtml(paper.authors)} · ${escapeHtml(
        paper.pdf_file
      )}
    </p>

    <div class="chips">
      ${(paper.topic_tags || [])
        .map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`)
        .join("")}
      <span class="chip alt">${escapeHtml(paper.figure_status)}</span>
    </div>

    ${paperFigureHtml(paper)}

    <div class="detail-grid">
      ${presentationExpressionsHtml(paper)}
      ${qaPracticeHtml(paper)}
      ${detailBlock("一句话", `<p>${escapeHtml(paper.one_sentence_zh)}</p>`)}
      ${detailBlock("任务介绍", `<p>${escapeHtml(flow.task_introduction)}</p>`)}
      ${detailBlock("动机", `<p>${escapeHtml(flow.motivation)}</p>`)}
      ${detailBlock("前人工作弊端", listHtml(flow.prior_work_limitations))}
      ${detailBlock("提出的方法", `<p>${escapeHtml(flow.proposed_method)}</p>`, true)}
      ${detailBlock("实验设计", `<p>${escapeHtml(flow.experiments)}</p>`, true)}
      ${detailBlock(
        "评价指标",
        `<ul>${metrics
          .map(
            (metric) =>
              `<li><strong>${escapeHtml(metric.name)}:</strong> ${escapeHtml(metric.meaning)}</li>`
          )
          .join("")}</ul>`,
        true
      )}
      ${detailBlock("主要结论", listHtml(flow.main_findings), true)}
      ${detailBlock("局限", listHtml(flow.limitations), true)}
      ${detailBlock(
        "方法模块",
        `<ul>${(paper.method_modules || [])
          .map(
            (module) =>
              `<li><strong>${escapeHtml(module.name)}:</strong> ${escapeHtml(module.description)}</li>`
          )
          .join("")}</ul>`,
        true
      )}
      ${detailBlock(
        "通用学术句式",
        `<div class="expression-list">${general
          .map(
            (item) => `
              <div class="expression-row">
                <div class="expression-actions">
                  <span class="chip">${escapeHtml(item.usage)}</span>
                  <button class="mini-button" type="button" data-speak="${escapeAttr(item.en)}">Listen</button>
                </div>
                <p class="english">${escapeHtml(item.en)}</p>
                <p>${escapeHtml(item.zh)}</p>
              </div>
            `
          )
          .join("")}</div>`,
        true
      )}
    </div>
  `;
}

function presentationExpressionsHtml(paper) {
  return detailBlock(
    "汇报表达",
    `<div class="expression-list">${(paper.english_presentation || [])
      .map(
        (item) => `
          <div class="expression-row">
            <div class="expression-actions">
              <span class="chip purple">${escapeHtml(item.stage)}</span>
              <button class="mini-button" type="button" data-speak="${escapeAttr(item.en)}">播放表达</button>
            </div>
            <p class="english">${escapeHtml(item.en)}</p>
            <p>${escapeHtml(item.zh)}</p>
          </div>
        `
      )
      .join("")}</div>`,
    true
  );
}

function qaPracticeHtml(paper) {
  return detailBlock(
    "问答练习",
    `<div class="qa-list">${(paper.qa_practice || [])
      .map(
        (item, index) => `
          <div class="qa-row">
            <div class="qa-heading">
              <span class="chip">Q${index + 1}</span>
              <button class="mini-button" type="button" data-speak="${escapeAttr(item.question)}">播放问题</button>
              <button class="mini-button" type="button" data-speak="${escapeAttr(item.answer)}">播放回答</button>
            </div>
            <div class="qa-pair">
              <span class="qa-label">Question</span>
              <h3>${escapeHtml(item.question)}</h3>
              <p>${escapeHtml(item.question_zh || "")}</p>
            </div>
            <div class="qa-pair">
              <span class="qa-label">Answer</span>
              <p class="english">${escapeHtml(item.answer)}</p>
              <p>${escapeHtml(item.answer_zh || "")}</p>
            </div>
          </div>
        `
      )
      .join("")}</div>`,
    true
  );
}

function paperFigureHtml(paper) {
  if (!/extracted/i.test(paper.figure_status || "")) return "";
  const baseName = String(paper.pdf_file || "").replace(/\.pdf$/i, "");
  if (!baseName) return "";
  const src = `../paper-reading-output/${baseName}/model_figure.png`;

  return `
    <figure class="model-figure-card">
      <a href="${escapeAttr(src)}" target="_blank" rel="noreferrer">
        <img src="${escapeAttr(src)}" alt="${escapeAttr(paper.short_title)} 模型框架图" loading="lazy" />
      </a>
      <figcaption>
        <strong>Model Figure</strong>
        <span>点击图片可查看原始尺寸。</span>
      </figcaption>
    </figure>
  `;
}

function detailBlock(title, body, wide = false) {
  return `
    <section class="detail-block ${wide ? "wide" : ""}">
      <h3>${escapeHtml(title)}</h3>
      ${body || "<p>论文中未明确说明。</p>"}
    </section>
  `;
}

function listHtml(items) {
  if (!items?.length) return "<p>论文中未明确说明。</p>";
  return `<ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
}

function updateStats() {
  nodes.sentenceCount.textContent = state.sentences.length;
  nodes.dialogueCount.textContent = state.dialogues.length;
  nodes.paperCount.textContent = state.papers.length;
  nodes.savedCount.textContent = Object.keys(state.progress.sentences || {}).length;
}

function toggleRemember(id) {
  if (!state.progress.sentences) state.progress.sentences = {};
  if (state.progress.sentences[id]) {
    delete state.progress.sentences[id];
  } else {
    state.progress.sentences[id] = new Date().toISOString();
  }
  saveProgress();
}

function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === "object"
      ? {
          sentences: parsed.sentences || {},
          dialogues: parsed.dialogues || {}
        }
      : { sentences: {}, dialogues: {} };
  } catch {
    return { sentences: {}, dialogues: {} };
  }
}

function saveProgress() {
  try {
    localStorage.setItem(
      PROGRESS_KEY,
      JSON.stringify({
        version: 1,
        updated_at: new Date().toISOString(),
        sentences: state.progress.sentences || {},
        dialogues: state.progress.dialogues || {}
      })
    );
  } catch {
    setStatus("当前浏览器未保存背诵进度");
  }
}

function setupVoices() {
  if (!("speechSynthesis" in window)) {
    nodes.voiceSelect.innerHTML = `<option>Speech unavailable</option>`;
    nodes.voiceSelect.disabled = true;
    return;
  }

  const load = () => {
    state.voices = window.speechSynthesis.getVoices();
    const englishVoices = state.voices.filter((voice) => /^en[-_]/i.test(voice.lang));
    const preferredIndex = englishVoices.findIndex((voice) => /en[-_]GB/i.test(voice.lang));

    nodes.voiceSelect.innerHTML = [
      `<option value="">Default English</option>`,
      ...englishVoices.map(
        (voice, index) =>
          `<option value="${index}" ${index === preferredIndex ? "selected" : ""}>${escapeHtml(
            voice.name
          )} · ${escapeHtml(voice.lang)}</option>`
      )
    ].join("");
  };

  load();
  window.speechSynthesis.onvoiceschanged = load;
}

function selectedVoice() {
  const englishVoices = state.voices.filter((voice) => /^en[-_]/i.test(voice.lang));
  const selected = Number(nodes.voiceSelect.value);
  if (Number.isInteger(selected) && englishVoices[selected]) return englishVoices[selected];
  return (
    englishVoices.find((voice) => /en[-_]GB/i.test(voice.lang)) ||
    englishVoices.find((voice) => /en[-_]US/i.test(voice.lang)) ||
    englishVoices[0] ||
    null
  );
}

function makeUtterance(text) {
  const utterance = new SpeechSynthesisUtterance(text);
  const voice = selectedVoice();
  utterance.lang = voice?.lang || "en-GB";
  utterance.voice = voice;
  utterance.rate = Number(nodes.rateControl.value) || 0.92;
  utterance.pitch = 1;
  return utterance;
}

function speakText(text, options = {}) {
  const content = String(text || "").trim();
  if (!content) return;

  if (!("speechSynthesis" in window)) {
    setStatus("当前浏览器不支持英文朗读");
    return;
  }

  if (!options.queue) stopSpeech();
  window.speechSynthesis.speak(makeUtterance(content));
}

function speakLines(lines) {
  stopSpeech();
  for (const line of lines.filter(Boolean)) {
    speakText(line, { queue: true });
  }
}

function stopSpeech() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function setStatus(message) {
  nodes.statusLine.textContent = message;
}

function searchableText(value) {
  return normalize(JSON.stringify(value || ""));
}

function normalize(value) {
  return String(value || "").toLowerCase();
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const map = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return map[char];
  });
}

function escapeAttr(value) {
  return escapeHtml(value);
}
