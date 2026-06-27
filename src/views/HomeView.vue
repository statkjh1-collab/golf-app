<script setup>
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import { useGolfStore } from '@/stores/golf'

const store = useGolfStore()
const teamResults = ref({}) // { meeting_id: { A: [], B: [] } }

async function drawTeams(meetingId) {
  await store.assignTeams(meetingId)
  const atts = store.attendances.filter(a => a.meeting_id === meetingId)
  teamResults.value[meetingId] = {
    A: atts.filter(a => a.team === 'A').map(a => store.members.find(m => m.id === a.member_id)?.name).filter(Boolean),
    B: atts.filter(a => a.team === 'B').map(a => store.members.find(m => m.id === a.member_id)?.name).filter(Boolean),
  }
}

function attendeesOf(meetingId) {
  return store.attendances
    .filter(a => a.meeting_id === meetingId)
    .map(a => store.members.find(m => m.id === a.member_id)?.name)
    .filter(Boolean)
}

function hasTeams(meetingId) {
  return store.attendances.filter(a => a.meeting_id === meetingId).some(a => a.team)
}

function formatDate(dateStr) {
  const d = new Date(dateStr)
  const days = ['일', '월', '화', '수', '목', '금', '토']
  return `${d.getMonth()+1}월 ${d.getDate()}일 (${days[d.getDay()]})`
}
</script>

<template>
  <main class="home">
    <section class="hero">
      <div class="hero-icon">⛳</div>
      <h1>아지트 스크린골프 모임</h1>
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

    <!-- 다가오는 일정 -->
    <section class="upcoming">
      <h2>다가오는 일정</h2>
      <div v-if="store.upcomingMeetings.length === 0" class="empty">예정된 모임이 없어요.</div>
      <div v-for="mt in store.upcomingMeetings.slice(0, 1)" :key="mt.id" class="meeting-card">
        <div class="meeting-header">
          <div>
            <div class="meeting-title">{{ mt.title }}</div>
            <div class="meeting-meta">{{ formatDate(mt.meet_date) }} · {{ mt.meet_time.slice(0,5) }}</div>
          </div>
          <span class="badge">{{ store.attendCount(mt.id) }}/{{ mt.capacity }}명</span>
        </div>

        <div v-if="attendeesOf(mt.id).length" class="attendees">
          참석: {{ attendeesOf(mt.id).join(', ') }}
        </div>
        <div v-else class="attendees empty-att">아직 참석 신청자가 없어요.</div>

        <div class="team-actions">
          <button class="btn-team" @click="drawTeams(mt.id)" :disabled="store.attendCount(mt.id) < 2 || hasTeams(mt.id)">
            🎲 {{ hasTeams(mt.id) ? '방 배정 완료' : '랜덤 방 배정' }}
          </button>
          <RouterLink to="/schedule" class="btn-link">참석 신청 →</RouterLink>
        </div>

        <!-- 기존 배정 결과 표시 -->
        <div v-if="hasTeams(mt.id)" class="team-result">
          <div class="team-box">
            <span class="team-label green">1번방</span>
            <span>{{ store.attendances.filter(a => a.meeting_id === mt.id && a.team === 'A').map(a => store.members.find(m => m.id === a.member_id)?.name).filter(Boolean).join(', ') }}</span>
          </div>
          <div class="team-box">
            <span class="team-label red">2번방</span>
            <span>{{ store.attendances.filter(a => a.meeting_id === mt.id && a.team === 'B').map(a => store.members.find(m => m.id === a.member_id)?.name).filter(Boolean).join(', ') }}</span>
          </div>
        </div>
        <!-- 랜덤 뽑기 결과 표시 -->
        <div v-else-if="teamResults[mt.id]" class="team-result">
          <div class="team-box">
            <span class="team-label green">1번방</span>
            <span>{{ teamResults[mt.id].A.join(', ') || '없음' }}</span>
          </div>
          <div class="team-box">
            <span class="team-label red">2번방</span>
            <span>{{ teamResults[mt.id].B.join(', ') || '없음' }}</span>
          </div>
        </div>
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
.home { max-width: 860px; margin: 0 auto; padding: 3rem 1.5rem; }

.hero { text-align: center; margin-bottom: 3rem; }
.hero-icon { font-size: 3rem; margin-bottom: 0.5rem; }
.hero h1 { font-size: 2rem; font-weight: 800; color: #eaf2e6; margin: 0 0 0.75rem; }
.hero p { color: #9db39e; font-size: 1rem; margin: 0 0 1.75rem; }
.hero-actions { display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap; }

.btn-cta { display: inline-block; background: #4e9a51; color: #fff; padding: 0.75rem 2rem; border-radius: 8px; font-weight: 700; font-size: 1rem; text-decoration: none; }
.btn-cta:hover { background: #3d7a40; }
.btn-outline { display: inline-block; background: transparent; color: #6fbf6f; padding: 0.75rem 2rem; border-radius: 8px; font-weight: 700; font-size: 1rem; text-decoration: none; border: 2px solid #2c4a33; }
.btn-outline:hover { border-color: #4e9a51; }

.stats { display: flex; gap: 1rem; margin-bottom: 3rem; }
.stat-card { flex: 1; background: #16271a; border: 1px solid #2c4a33; border-radius: 10px; padding: 1.5rem; text-align: center; display: flex; flex-direction: column; gap: 0.25rem; }
.stat-number { font-size: 2rem; font-weight: 800; color: #6fbf6f; }
.stat-label { font-size: 0.9rem; color: #9db39e; }

.upcoming { margin-bottom: 3rem; }
.upcoming h2, .rules h2 { font-size: 1.3rem; font-weight: 700; color: #eaf2e6; margin-bottom: 1.25rem; }
.empty { color: #9db39e; font-size: 0.9rem; }

.meeting-card { background: #16271a; border: 1px solid #2c4a33; border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem; }
.meeting-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem; }
.meeting-title { font-weight: 700; color: #eaf2e6; font-size: 1rem; }
.meeting-meta { color: #9db39e; font-size: 0.85rem; margin-top: 0.2rem; }
.badge { background: #2c4a33; color: #eaf2e6; font-size: 0.8rem; padding: 0.25rem 0.65rem; border-radius: 20px; font-weight: 600; white-space: nowrap; }

.attendees { font-size: 0.85rem; color: #9db39e; margin-bottom: 0.75rem; line-height: 1.6; }
.empty-att { font-style: italic; }

.team-actions { display: flex; align-items: center; gap: 0.75rem; }
.btn-team { background: #2c4a33; color: #eaf2e6; border: 1px solid #3d6642; border-radius: 8px; padding: 0.55rem 1rem; font-size: 0.88rem; font-weight: 600; cursor: pointer; }
.btn-team:hover:not(:disabled) { background: #3d6642; }
.btn-team:disabled { opacity: 0.4; cursor: not-allowed; }
.btn-link { color: #6fbf6f; font-size: 0.88rem; text-decoration: none; font-weight: 600; }

.team-result { margin-top: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem; }
.team-box { background: #1d3324; border: 1px solid #2c4a33; border-radius: 8px; padding: 0.6rem 0.9rem; font-size: 0.88rem; color: #eaf2e6; display: flex; gap: 0.75rem; align-items: baseline; }
.team-label { font-weight: 700; font-size: 0.85rem; flex-shrink: 0; }
.team-label.green { color: #6fbf6f; }
.team-label.red { color: #e8543e; }

.rule-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 1rem; }
.rule-card { border: 1px solid #2c4a33; border-radius: 10px; padding: 1.25rem; background: #16271a; display: flex; flex-direction: column; gap: 0.4rem; }
.rule-icon { font-size: 1.8rem; }
.rule-card strong { color: #eaf2e6; font-size: 0.95rem; }
.rule-card p { color: #9db39e; font-size: 0.85rem; margin: 0; line-height: 1.6; }
</style>
