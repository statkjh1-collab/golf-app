<script setup>
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { lastSection } from '@/router'

const route = useRoute()
const router = useRouter()

const MENUS = [
  { key: 'schedule', label: '일정·참석' },
  { key: 'ranking', label: '순위표' },
  { key: 'finance', label: '회비' },
  { key: 'admin', label: '관리자' },
]

// 지금 보는 화면의 구분. 홈처럼 공통 화면이면 마지막으로 본 구분을 쓴다.
// (localStorage는 반응형이 아니라서 route.path를 읽어 이동할 때마다 다시 계산되게 한다)
const section = computed(() => {
  if (route.meta.section) return route.meta.section
  void route.path
  return lastSection()
})

function switchTo(next) {
  if (next === section.value && route.meta.section) return
  // 같은 하위 메뉴를 유지한 채 구분만 바꾼다
  const sub = route.meta.section ? route.path.split('/')[2] : 'schedule'
  router.push(`/${next}/${sub || 'schedule'}`)
}
</script>

<template>
  <nav class="nav">
    <div class="nav-top">
      <RouterLink to="/" class="nav-brand">
        <span class="brand-full">⛳ 아지트 골프모임</span>
        <span class="brand-short">⛳ 아지트</span>
      </RouterLink>
      <div class="top-right">
      <div class="toggle" role="tablist" aria-label="모임 구분">
        <button
          v-for="s in [{ key: 'screen', label: '스크린' }, { key: 'field', label: '필드' }]"
          :key="s.key"
          role="tab"
          :aria-selected="section === s.key"
          :class="{ on: section === s.key }"
          @click="switchTo(s.key)"
        >{{ s.label }}</button>
      </div>
      <RouterLink to="/rules" class="rules-link" title="회칙" aria-label="회칙">📖</RouterLink>
      </div>
    </div>
    <div class="nav-links">
      <RouterLink v-for="m in MENUS" :key="m.key" :to="`/${section}/${m.key}`">{{ m.label }}</RouterLink>
    </div>
  </nav>
</template>

<style scoped>
.nav {
  background: #0f1b12;
  border-bottom: 2px solid #2c4a33;
  position: sticky;
  top: 0;
  z-index: 10;
}

.nav-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0 1.25rem;
  height: 52px;
}

.nav-brand {
  font-weight: 800;
  color: #6fbf6f;
  text-decoration: none;
  white-space: nowrap;
  font-size: 1.05rem;
}
.brand-short { display: none; }

.top-right { display: flex; align-items: center; gap: 0.5rem; }
.rules-link {
  font-size: 1.15rem;
  text-decoration: none;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border-radius: 999px;
  border: 1px solid transparent;
}
.rules-link:hover { border-color: #2c4a33; }
.rules-link.router-link-active { border-color: #4e9a51; background: #16271a; }

.toggle {
  display: flex;
  background: #16271a;
  border: 1px solid #2c4a33;
  border-radius: 999px;
  padding: 3px;
}
.toggle button {
  border: 0;
  background: transparent;
  color: #9db39e;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  padding: 0.35rem 0.95rem;
  border-radius: 999px;
  cursor: pointer;
}
.toggle button.on {
  background: #4e9a51;
  color: #fff;
}

.nav-links {
  display: flex;
  gap: 1.25rem;
  padding: 0 1.25rem;
  height: 40px;
  align-items: center;
  border-top: 1px solid #1d3324;
}

.nav-links a {
  text-decoration: none;
  color: #9db39e;
  font-size: 0.9rem;
  font-weight: 500;
  white-space: nowrap;
}

.nav-links a.router-link-active {
  color: #6fbf6f;
  font-weight: 700;
}

@media (max-width: 480px) {
  .nav-top, .nav-links { padding: 0 1rem; }
  .brand-full { display: none; }
  .brand-short { display: inline; }
  .nav-links { gap: 0; justify-content: space-between; }
  .nav-links a { font-size: 0.85rem; }
}
</style>
