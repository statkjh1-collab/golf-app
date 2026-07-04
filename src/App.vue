<script setup>
import { onMounted } from 'vue'
import AppNav from '@/components/AppNav.vue'
import { useGolfStore } from '@/stores/golf'

const store = useGolfStore()
onMounted(() => store.init())
</script>

<template>
  <AppNav />
  <RouterView />
</template>

<style>
*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  font-family: 'Pretendard', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #0f1b12;
  color: #eaf2e6;
}
</style>
