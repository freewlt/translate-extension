<template>
  <div class="app">
    <header class="header">
      <div class="header-brand">
        <span class="brand-icon">🌐</span>
        <span class="brand-name">贴心译</span>
      </div>
      <nav class="tabs">
        <button
          v-for="tab in tabs"
          :key="tab.id"
          class="tab"
          :class="{ active: active === tab.id }"
          @click="switchTab(tab.id)"
        >
          {{ tab.label }}
          <span v-if="tab.id === 'flashcards' && dueCount > 0" class="tab-badge">
            {{ dueCount }}
          </span>
        </button>
      </nav>
    </header>

    <main class="main">
      <TranslateTab v-show="active === 'translate'" @card-added="onCardAdded" />
      <FlashcardsTab v-show="active === 'flashcards'" ref="fcRef" />
    </main>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import TranslateTab  from './components/TranslateTab.vue'
import FlashcardsTab from './components/FlashcardsTab.vue'

const active   = ref('translate')
const dueCount = ref(0)
const fcRef    = ref(null)

const tabs = [
  { id: 'translate',  label: '翻译' },
  { id: 'flashcards', label: '记忆卡片' },
]

async function loadDueCount() {
  const { flashcards = [] } = await chrome.storage.local.get('flashcards')
  dueCount.value = flashcards.filter(c => c.nextReview <= Date.now()).length
}

function switchTab(id) {
  active.value = id
  if (id === 'flashcards') fcRef.value?.reload()
}

async function onCardAdded() {
  await loadDueCount()
  fcRef.value?.reload()
}

onMounted(loadDueCount)
</script>
