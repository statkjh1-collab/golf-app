<script setup>
import { useGolfStore } from '@/stores/golf'
import { RouterLink } from 'vue-router'

const store = useGolfStore()
</script>

<template>
  <main class="home">
    <section class="hero">
      <div class="hero-icon">⛳</div>
      <h1>스크린골프 정기모임</h1>
      <p>월 2회 정기 라운드 · 핸디캡 적용 · 순위별 식대 정산</p>
      <div class="hero-actions">
        <RouterLink to="/schedule" class="btn-cta">일정 · 참석 신청</RouterLink>
        <RouterLink to="/ranking" class="btn-outline">순위표 보기</RouterLink>
      </div>
    </section>

    <section class="stats">
      <div class="stat-card">
        <span class="stat-number">{{ store.members.length }}</span>
        <span class="stat-label">전체 회원</span>
      </div>
      <div class="stat-card">
        <span class="stat-number">{{ store.upcomingMeetings.length }}</span>
        <span class="stat-label">예정 모임</span>
      </div>
      <div class="stat-card">
        <span class="stat-number">{{ store.doneMeetings.length }}</span>
        <span class="stat-label">완료 모임</span>
      </div>
    </section>

    <section class="rules">
      <h2>운영 규정</h2>
      <div class="rule-grid">
        <div class="rule-card">
          <span class="rule-icon">📅</span>
          <strong>월 2회 정기</strong>
          <p>둘째 주 일요일 오후 3시<br>넷째 주 일요일 오전 11시</p>
        </div>
        <div class="rule-card">
          <span class="rule-icon">🏌️</span>
          <strong>핸디캡 적용</strong>
          <p>순스코어 = 타수 + 멀리건 − 핸디<br>멀리건 1회 제공</p>
        </div>
        <div class="rule-card">
          <span class="rule-icon">🎲</span>
          <strong>랜덤 2개 조</strong>
          <p>매 모임 랜덤 배정으로<br>다양한 회원과 라운드</p>
        </div>
        <div class="rule-card">
          <span class="rule-icon">🍽️</span>
          <strong>순위별 식대</strong>
          <p>1등 5% ~ 꼴찌 15%<br>인원수에 맞춰 자동 계산</p>
        </div>
      </div>
    </section>
  </main>
</template>

<style scoped>
.home {
  max-width: 860px;
  margin: 0 auto;
  padding: 3rem 1.5rem;
}

.hero {
  text-align: center;
  margin-bottom: 3rem;
}

.hero-icon { font-size: 3rem; margin-bottom: 0.5rem; }

.hero h1 {
  font-size: 2rem;
  font-weight: 800;
  color: #eaf2e6;
  margin: 0 0 0.75rem;
}

.hero p {
  color: #9db39e;
  font-size: 1rem;
  margin: 0 0 1.75rem;
}

.hero-actions {
  display: flex;
  gap: 0.75rem;
  justify-content: center;
  flex-wrap: wrap;
}

.btn-cta {
  display: inline-block;
  background: #4e9a51;
  color: #fff;
  padding: 0.75rem 2rem;
  border-radius: 8px;
  font-weight: 700;
  font-size: 1rem;
  text-decoration: none;
}
.btn-cta:hover { background: #3d7a40; }

.btn-outline {
  display: inline-block;
  background: transparent;
  color: #6fbf6f;
  padding: 0.75rem 2rem;
  border-radius: 8px;
  font-weight: 700;
  font-size: 1rem;
  text-decoration: none;
  border: 2px solid #2c4a33;
}
.btn-outline:hover { border-color: #4e9a51; }

.stats {
  display: flex;
  gap: 1rem;
  margin-bottom: 3rem;
}

.stat-card {
  flex: 1;
  background: #16271a;
  border: 1px solid #2c4a33;
  border-radius: 10px;
  padding: 1.5rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.stat-number {
  font-size: 2rem;
  font-weight: 800;
  color: #6fbf6f;
}

.stat-label {
  font-size: 0.9rem;
  color: #9db39e;
}

.rules h2 {
  font-size: 1.3rem;
  font-weight: 700;
  color: #eaf2e6;
  margin-bottom: 1.25rem;
}

.rule-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.rule-card {
  border: 1px solid #2c4a33;
  border-radius: 10px;
  padding: 1.25rem;
  background: #16271a;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.rule-icon { font-size: 1.8rem; }
.rule-card strong { color: #eaf2e6; font-size: 0.95rem; }
.rule-card p { color: #9db39e; font-size: 0.85rem; margin: 0; line-height: 1.6; }
</style>
