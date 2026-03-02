// background.js — Service Worker
// Registers the right-click context menu and routes pending translations.

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'translate') {
    translateText(message.text)
      .then(translation => sendResponse({ translation }))
      .catch(err => sendResponse({ error: err.message }))
    return true
  }
})

// Fetch with timeout helper
async function fetchWithTimeout(url, options, ms) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  try {
    return await fetch(url, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

async function translateText(text) {
  // 1. Google Translate (fast, no quota — blocked in China)
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=zh-CN&dt=t&q=${encodeURIComponent(text)}`
    const res = await fetchWithTimeout(url, {}, 3000)
    const data = await res.json()
    return data[0].map(chunk => chunk[0]).join('')
  } catch {}

  // 2. Microsoft Edge Translator (accessible in China)
  try {
    const tokenRes = await fetchWithTimeout('https://edge.microsoft.com/translate/auth', {}, 5000)
    const token = await tokenRes.text()
    const transRes = await fetchWithTimeout(
      'https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=zh-Hans',
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify([{ Text: text }]),
      },
      8000
    )
    const data = await transRes.json()
    return data[0].translations[0].text
  } catch {}

  // 3. MyMemory fallback (daily quota limit)
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|zh-CN`
  const res = await fetchWithTimeout(url, {}, 8000)
  const data = await res.json()
  if (data.responseStatus === 200) return data.responseData.translatedText
  throw new Error('所有翻译服务均不可用，请检查网络')
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'translate-selection',
    title: '翻译 "%s"',
    contexts: ['selection'],
  })
})

chrome.contextMenus.onClicked.addListener(async (info) => {
  if (info.menuItemId === 'translate-selection' && info.selectionText) {
    await chrome.storage.local.set({
      pendingTranslation: { text: info.selectionText.trim() },
    })
    // The popup will pick this up when it opens.
  }
})
