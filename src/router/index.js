import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', component: HomeView },
    { path: '/schedule', component: () => import('../views/ScheduleView.vue') },
    { path: '/ranking', component: () => import('../views/RankingView.vue') },
    { path: '/admin', component: () => import('../views/AdminView.vue') },
  ],
})

export default router
