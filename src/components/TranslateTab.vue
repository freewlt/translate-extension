<template>
  <div>
    <!-- Language selectors -->
    <div class="lang-bar">
      <select v-model="srcLang" class="lang-select">
        <option v-for="l in LANGS" :key="l.code" :value="l.code">{{ l.name }}</option>
      </select>

      <button class="swap-btn" :disabled="srcLang === 'auto'" @click="swap" title="交换语言">⇄</button>

      <select v-model="tgtLang" class="lang-select">
        <option v-for="l in TARGET_LANGS" :key="l.code" :value="l.code">{{ l.name }}</option>
      </select>
    </div>

    <!-- Input -->
    <div class="input-wrap">
      <textarea
        v-model="input"
        class="input-text"
        placeholder="输入要翻译的文字，或在网页上划词…"
        rows="4"
        maxlength="2000"
      />
      <div class="input-footer">
        <span class="char-count">{{ input.length }}/2000</span>
        <span v-if="loading" class="auto-hint">翻译中…</span>
        <button v-if="input" class="clear-btn" @click="clear">✕</button>
      </div>
    </div>

    <!-- Error -->
    <div v-if="error" class="error-box">⚠ {{ error }}</div>

    <!-- Result -->
    <Transition name="slide-up">
      <div v-if="result" class="result-box">
        <div class="result-header">
          <span class="result-label">翻译结果</span>
          <button class="icon-btn" title="朗读" @click="speak">🔊</button>
        </div>
        <p class="result-text">{{ result }}</p>
        <div class="result-actions">
          <button class="btn btn-outline" @click="copy">
            {{ copied ? '✓ 已复制' : '📋 复制' }}
          </button>
          <button class="btn btn-primary" :disabled="cardAdded" @click="addCard">
            {{ cardAdded ? '✓ 已添加' : '＋ 添加到卡片' }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'

const emit = defineEmits(['card-added'])

/* ── language lists ──────────────────────────────────────────── */
const LANGS = [
  { code: 'auto',  name: '自动检测' },
  { code: 'zh-CN', name: '中文' },
  { code: 'en',    name: '英语' },
  { code: 'ja',    name: '日语' },
  { code: 'ko',    name: '韩语' },
  { code: 'fr',    name: '法语' },
  { code: 'de',    name: '德语' },
  { code: 'es',    name: '西班牙语' },
  { code: 'ru',    name: '俄语' },
  { code: 'ar',    name: '阿拉伯语' },
]
const TARGET_LANGS = computed(() => LANGS.filter(l => l.code !== 'auto'))

/* ── state ───────────────────────────────────────────────────── */
const srcLang   = ref('auto')
const tgtLang   = ref('zh-CN')
const input     = ref('')
const result    = ref('')
const loading   = ref(false)
const error     = ref('')
const copied    = ref(false)
const cardAdded = ref(false)

/* ── helpers ─────────────────────────────────────────────────── */
function clear() {
  input.value = ''; result.value = ''; error.value = ''
  copied.value = false; cardAdded.value = false
}

function swap() {
  if (srcLang.value === 'auto') return
  const tmp = srcLang.value
  srcLang.value = tgtLang.value
  tgtLang.value = tmp
  if (result.value) { input.value = result.value; result.value = '' }
}

let debounceTimer = null
watch(input, (val) => {
  clearTimeout(debounceTimer)
  if (!val.trim()) { result.value = ''; error.value = ''; return }
  debounceTimer = setTimeout(doTranslate, 600)
})

async function fetchWithTimeout(url, options, ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function doTranslate() {
  const text = input.value.trim()
  if (!text || loading.value) return

  loading.value = true; error.value = ''; result.value = ''; cardAdded.value = false

  try {
    let translation = ''

    // 1. Google Translate (fast, no quota — blocked in China)
    try {
      const url =
        `https://translate.googleapis.com/translate_a/single?client=gtx` +
        `&sl=${srcLang.value}&tl=${tgtLang.value}&dt=t&q=${encodeURIComponent(text)}`
      const res  = await fetchWithTimeout(url, {}, 3000)
      const data = await res.json()
      translation = data[0].map(chunk => chunk[0]).join('')
    } catch {
      // 2. Microsoft Edge Translator (accessible in China)
      try {
        const msLang = tgtLang.value === 'zh-CN' ? 'zh-Hans' : tgtLang.value
        const tokenRes = await fetchWithTimeout('https://edge.microsoft.com/translate/auth', {}, 5000)
        const token = await tokenRes.text()
        const transRes = await fetchWithTimeout(
          `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${msLang}`,
          {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify([{ Text: text }]),
          },
          8000
        )
        const data = await transRes.json()
        translation = data[0].translations[0].text
      } catch {
        // 3. MyMemory fallback (daily quota limit)
        const url =
          `https://api.mymemory.translated.net/get` +
          `?q=${encodeURIComponent(text)}&langpair=${srcLang.value}|${tgtLang.value}`
        const res  = await fetchWithTimeout(url, {}, 8000)
        const data = await res.json()
        if (data.responseStatus === 200) {
          translation = data.responseData.translatedText
        } else {
          throw new Error('所有翻译服务均不可用')
        }
      }
    }
    result.value = translation
  } catch {
    error.value = '所有翻译服务均不可用，请检查网络'
  } finally {
    loading.value = false
  }
}

async function copy() {
  try {
    await navigator.clipboard.writeText(result.value)
    copied.value = true; setTimeout(() => (copied.value = false), 2000)
  } catch { /* ignore */ }
}

async function addCard() {
  if (!input.value.trim() || !result.value) return

  const { flashcards = [] } = await chrome.storage.local.get('flashcards')
  flashcards.push({
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    front: input.value.trim(),
    back: result.value,
    sourceLang: srcLang.value,
    targetLang: tgtLang.value,
    created: Date.now(),
    reviewCount: 0,
    nextReview: Date.now(),
    interval: 1,
    easeFactor: 2.5,
  })
  await chrome.storage.local.set({ flashcards })
  cardAdded.value = true
  emit('card-added')
}

function speak() {
  const u = new SpeechSynthesisUtterance(result.value)
  u.lang = tgtLang.value
  speechSynthesis.cancel()
  speechSynthesis.speak(u)
}

/* ── pick up pending translation from context-menu ───────────── */
onMounted(async () => {
  const { pendingTranslation } = await chrome.storage.local.get('pendingTranslation')
  if (pendingTranslation?.text) {
    input.value = pendingTranslation.text
    await chrome.storage.local.remove('pendingTranslation')
    doTranslate()
  }
})
</script>
