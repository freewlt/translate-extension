// content.js — injected into every page
// Shows a floating translation popup when the user selects text.

;(function () {
  'use strict'

  let popup = null

  /* ── helpers ──────────────────────────────────────────── */
  async function translate(text) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({ type: 'translate', text }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message))
        } else if (response.error) {
          reject(new Error(response.error))
        } else {
          resolve(response.translation)
        }
      })
    })
  }

  async function addFlashcard(front, back) {
    const { flashcards = [] } = await chrome.storage.local.get('flashcards')
    flashcards.push({
      id: Date.now().toString() + Math.random().toString(36).slice(2),
      front,
      back,
      sourceLang: 'auto',
      targetLang: 'zh-CN',
      created: Date.now(),
      reviewCount: 0,
      nextReview: Date.now(),
      interval: 1,
      easeFactor: 2.5,
    })
    await chrome.storage.local.set({ flashcards })
  }

  /* ── popup lifecycle ──────────────────────────────────── */
  function removePopup() {
    if (popup) {
      popup.remove()
      popup = null
    }
  }

  function createPopup(text, anchorX, anchorY) {
    removePopup()

    popup = document.createElement('div')
    popup.id = 'te-popup'
    popup.innerHTML = `
      <div class="te-bar">
        <button class="te-btn te-translate-btn">翻译</button>
        <button class="te-btn te-close-btn" title="关闭">✕</button>
      </div>
      <div class="te-body" style="display:none">
        <div class="te-loading">
          <span class="te-spinner"></span><span>翻译中…</span>
        </div>
        <div class="te-result" style="display:none"></div>
        <div class="te-actions" style="display:none">
          <button class="te-btn te-card-btn">＋ 添加到记忆卡片</button>
        </div>
      </div>`
    document.body.appendChild(popup)

    // Position near cursor, stay inside viewport
    const pw = 280
    const scrollX = window.scrollX
    const scrollY = window.scrollY
    const vw = window.innerWidth
    let left = anchorX + scrollX + 12
    let top = anchorY + scrollY + 12
    if (anchorX + pw + 20 > vw) left = anchorX + scrollX - pw - 12
    popup.style.left = left + 'px'
    popup.style.top = top + 'px'

    // Store source text
    popup.dataset.source = text

    /* events */
    popup.querySelector('.te-translate-btn').onclick = () => doTranslate(text)
    popup.querySelector('.te-close-btn').onclick = removePopup
  }

  async function doTranslate(text) {
    const el      = popup
    const body    = el.querySelector('.te-body')
    const loading = el.querySelector('.te-loading')
    const result  = el.querySelector('.te-result')
    const actions = el.querySelector('.te-actions')
    const cardBtn = el.querySelector('.te-card-btn')

    body.style.display = 'block'
    loading.style.display = 'flex'
    result.style.display = 'none'
    actions.style.display = 'none'

    try {
      const translation = await translate(text)

      result.textContent = translation
      loading.style.display = 'none'
      result.style.display = 'block'
      actions.style.display = 'flex'

      cardBtn.onclick = async () => {
        await addFlashcard(text, translation)
        cardBtn.textContent = '✓ 已添加'
        cardBtn.disabled = true
      }
    } catch {
      result.textContent = '翻译失败，请重试'
      loading.style.display = 'none'
      result.style.display = 'block'
    }
  }

  /* ── selection listener ───────────────────────────────── */
  document.addEventListener('mouseup', (e) => {
    setTimeout(() => {
      if (popup && popup.contains(e.target)) return
      const sel = window.getSelection()
      const text = sel ? sel.toString().trim() : ''
      if (text.length > 1 && text.length <= 500) {
        createPopup(text, e.clientX, e.clientY)
      } else if (!text) {
        // clicked elsewhere
      }
    }, 120)
  })

  document.addEventListener('mousedown', (e) => {
    if (popup && !popup.contains(e.target)) removePopup()
  })
})()
