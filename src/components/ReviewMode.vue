<template>
  <div class="review-mode">
    <!-- Progress bar -->
    <div class="progress-bar">
      <div class="progress-fill" :style="{ width: pct + '%' }" />
    </div>
    <p class="progress-text">{{ idx + 1 }} / {{ queue.length }}</p>

    <!-- 3-D flip card -->
    <div class="review-card" @click="!flipped && flip()">
      <div class="card-inner" :class="{ flipped }">
        <!-- Front -->
        <div class="card-face front">
          <p class="card-word">{{ cur.front }}</p>
          <p class="card-hint">点击卡片翻转</p>
        </div>
        <!-- Back -->
        <div class="card-face back">
          <p class="card-word" style="color:#4f46e5;font-size:15px;">{{ cur.front }}</p>
          <div class="card-divider" />
          <p class="card-translation">{{ cur.back }}</p>
        </div>
      </div>
    </div>

    <!-- Flip button -->
    <div v-if="!flipped" class="flip-area">
      <button class="flip-btn" @click="flip">翻转查看答案</button>
    </div>

    <!-- Rating buttons -->
    <div v-else class="rating-area">
      <p class="rating-label">你的掌握程度：</p>
      <div class="rating-btns">
        <button class="rating-btn hard" @click="rate(1)">😓 难</button>
        <button class="rating-btn ok"   @click="rate(3)">🤔 一般</button>
        <button class="rating-btn easy" @click="rate(5)">😊 简单</button>
      </div>
    </div>

    <button class="text-btn exit-btn" @click="$emit('exit')">退出复习</button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({ queue: { type: Array, required: true } })
const emit  = defineEmits(['done', 'exit'])

const idx     = ref(0)
const flipped = ref(false)
const results = ref([])      // accumulated updated cards

const cur = computed(() => props.queue[idx.value])
const pct = computed(() => (idx.value / props.queue.length) * 100)

function flip() { flipped.value = true }

function rate(rating) {
  const card = { ...cur.value }

  // ── SM-2 simplified ──────────────────────────────────────
  let { interval, easeFactor, reviewCount } = card
  reviewCount++

  if (rating >= 3) {
    if      (reviewCount === 1) interval = 1
    else if (reviewCount === 2) interval = 6
    else                        interval = Math.round(interval * easeFactor)

    easeFactor = Math.max(1.3, easeFactor + 0.1 - (5 - rating) * 0.18)
  } else {
    interval    = 1
    reviewCount = 0
  }

  results.value.push({
    ...card,
    interval,
    easeFactor,
    reviewCount,
    nextReview: Date.now() + interval * 86400000,
  })

  if (idx.value + 1 >= props.queue.length) {
    emit('done', results.value)
  } else {
    idx.value++
    flipped.value = false
  }
}
</script>
