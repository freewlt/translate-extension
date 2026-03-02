<template>
  <div class="flashcards-tab">

    <!-- Stats ─────────────────────────────────────────────── -->
    <div class="stats-bar">
      <div class="stat-card">
        <span class="stat-num">{{ cards.length }}</span>
        <span class="stat-label">卡片总数</span>
      </div>
      <div class="stat-card due">
        <span class="stat-num">{{ dueCards.length }}</span>
        <span class="stat-label">待复习</span>
      </div>
      <div class="stat-card mastered">
        <span class="stat-num">{{ masteredCount }}</span>
        <span class="stat-label">已掌握</span>
      </div>
    </div>

    <!-- Start review ──────────────────────────────────────── -->
    <button
      class="review-btn"
      :disabled="dueCards.length === 0 || reviewing"
      @click="startReview"
    >
      {{ dueCards.length > 0 ? `开始复习 (${dueCards.length} 张)` : '暂无待复习卡片' }}
    </button>

    <!-- Review Mode ───────────────────────────────────────── -->
    <ReviewMode
      v-if="reviewing"
      :queue="reviewQueue"
      @done="onReviewDone"
      @exit="reviewing = false"
    />

    <!-- Card list ─────────────────────────────────────────── -->
    <template v-if="!reviewing">
      <!-- Empty -->
      <div v-if="cards.length === 0" class="empty-state">
        <span class="empty-icon">📚</span>
        <p>还没有记忆卡片</p>
        <p class="empty-hint">翻译后点击「＋ 添加到卡片」</p>
      </div>

      <template v-else>
        <div class="list-header">
          <input v-model="search" class="search-input" placeholder="🔍 搜索卡片…" />
          <button class="text-btn danger" @click="confirmClear">清空全部</button>
        </div>

        <div class="cards-list">
          <TransitionGroup name="list">
            <div v-for="card in filtered" :key="card.id" class="card-item">
              <div class="card-item-body">
                <p class="card-front">{{ card.front }}</p>
                <p class="card-back">{{ card.back }}</p>
              </div>
              <div class="card-item-meta">
                <span class="card-status" :class="statusClass(card)">
                  {{ statusLabel(card) }}
                </span>
                <button class="icon-btn delete-btn" title="删除" @click="del(card.id)">🗑</button>
              </div>
            </div>
          </TransitionGroup>
        </div>
      </template>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import ReviewMode from './ReviewMode.vue'

/* ── state ───────────────────────────────────────────────────── */
const cards      = ref([])
const search     = ref('')
const reviewing  = ref(false)
const reviewQueue = ref([])

/* ── derived ─────────────────────────────────────────────────── */
const dueCards     = computed(() => cards.value.filter(c => c.nextReview <= Date.now()))
const masteredCount = computed(() => cards.value.filter(c => c.interval >= 21).length)

const filtered = computed(() => {
  const q = search.value.toLowerCase()
  return q
    ? cards.value.filter(c =>
        c.front.toLowerCase().includes(q) || c.back.toLowerCase().includes(q))
    : cards.value
})

/* ── storage ─────────────────────────────────────────────────── */
async function load() {
  const { flashcards = [] } = await chrome.storage.local.get('flashcards')
  cards.value = flashcards
}

async function persist() {
  await chrome.storage.local.set({ flashcards: cards.value })
}

/* ── actions ─────────────────────────────────────────────────── */
async function del(id) {
  cards.value = cards.value.filter(c => c.id !== id)
  await persist()
}

async function confirmClear() {
  if (confirm('确定要清空所有记忆卡片吗？此操作不可撤销。')) {
    cards.value = []
    await persist()
  }
}

function startReview() {
  reviewQueue.value = [...dueCards.value]
  reviewing.value   = true
}

async function onReviewDone(updated) {
  updated.forEach(u => {
    const i = cards.value.findIndex(c => c.id === u.id)
    if (i !== -1) cards.value[i] = u
  })
  await persist()
  reviewing.value = false
}

/* ── card status helpers ─────────────────────────────────────── */
function statusClass(card) {
  if (card.interval >= 21) return 'mastered'
  if (card.nextReview <= Date.now()) return 'due'
  return 'pending'
}

function statusLabel(card) {
  if (card.interval >= 21) return '已掌握'
  if (card.nextReview <= Date.now()) return '待复习'
  const days = Math.ceil((card.nextReview - Date.now()) / 86400000)
  return `${days}天后`
}

/* ── expose & lifecycle ──────────────────────────────────────── */
defineExpose({ reload: load })
onMounted(load)
</script>
