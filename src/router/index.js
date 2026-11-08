import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

export const SECTIONS = ['screen', 'field']
export const LAST_SECTION_KEY = 'agit:lastSection'

const FieldComingSoon = () => import('../views/field/FieldComingSoon.vue')

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    // 공통
    { path: '/', component: HomeView },
    { path: '/register', component: () => import('../views/RegisterView.vue') },

    // 스크린 (기존 화면 그대로)
    { path: '/screen', redirect: '/screen/schedule' },
    { path: '/screen/schedule', component: () => import('../views/ScheduleView.vue'), meta: { section: 'screen' } },
    { path: '/screen/ranking', component: () => import('../views/RankingView.vue'), meta: { section: 'screen' } },
    { path: '/screen/finance', component: () => import('../views/FinanceView.vue'), meta: { section: 'screen' } },
    { path: '/screen/admin', component: () => import('../views/AdminView.vue'), meta: { section: 'screen' } },

    // 필드 (2단계부터 채움)
    { path: '/field', redirect: '/field/schedule' },
    { path: '/field/schedule', component: FieldComingSoon, meta: { section: 'field', title: '일정·참석' } },
    { path: '/field/ranking', component: FieldComingSoon, meta: { section: 'field', title: '순위표' } },
    { path: '/field/finance', component: FieldComingSoon, meta: { section: 'field', title: '회비' } },
    { path: '/field/admin', component: FieldComingSoon, meta: { section: 'field', title: '관리자' } },

    // 예전 주소(단톡방에 공유된 링크 등)는 스크린으로 연결
    { path: '/schedule', redirect: '/screen/schedule' },
    { path: '/ranking', redirect: '/screen/ranking' },
    { path: '/finance', redirect: '/screen/finance' },
    { path: '/admin', redirect: '/screen/admin' },

    { path: '/:pathMatch(.*)*', redirect: '/' },
  ],
})

// 마지막으로 본 구분(스크린/필드)을 기억한다
router.afterEach(to => {
  const section = to.meta.section
  if (!section) return
  try { localStorage.setItem(LAST_SECTION_KEY, section) } catch { /* 저장 불가 환경 무시 */ }
})

export function lastSection() {
  try {
    const v = localStorage.getItem(LAST_SECTION_KEY)
    return SECTIONS.includes(v) ? v : 'screen'
  } catch {
    return 'screen'
  }
}

export default router
