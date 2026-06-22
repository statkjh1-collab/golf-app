<script setup>
import AppNav from '@/components/AppNav.vue'
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
