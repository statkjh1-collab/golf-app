<script setup>
import { useRoute } from 'vue-router'
const route = useRoute()
</script>

<template>
  <main class="soon">
    <div class="icon">🏌️</div>
    <h1>필드 {{ route.meta.title }}</h1>
    <p>필드 정기라운드 기능은 준비 중이에요.</p>
    <RouterLink to="/field/schedule" class="btn">필드 일정 보기</RouterLink>
  </main>
</template>

<style scoped>
.soon { max-width: 560px; margin: 0 auto; padding: 4rem 1.25rem; text-align: center; }
.icon { font-size: 2.5rem; margin-bottom: 0.5rem; }
h1 { font-size: 1.4rem; color: #eaf2e6; margin: 0 0 0.5rem; }
p { color: #9db39e; font-size: 0.9rem; margin: 0 0 1.5rem; }
.btn { display: inline-block; color: #6fbf6f; border: 2px solid #2c4a33; border-radius: 8px; padding: 0.6rem 1.4rem; font-weight: 700; text-decoration: none; }
</style>
