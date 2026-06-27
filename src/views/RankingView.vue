<script setup>
import { ref } from 'vue'
import { useGolfStore } from '@/stores/golf'

const store = useGolfStore()
const tab = ref('cumulative')

function scoresOf(meetingId) {
  return store.scores
    .filter(s => s.meeting_id === meetingId && s.rank != null)
    .sort((a, b) => a.rank - b.rank)
    .map(s => ({ ...s, name: store.members.find(m => m.id === s.member_id)?.name || '?' }))
}
</script>

<template>
  <main class="page">
    <h1>순위표</h1>

    <div class="tabs">
      <button :class="['tab', { active: tab === 'cumulative' }]" @click="tab = 'cumulative'">누적 랭킹</button>
      <button :class="['tab', { active: tab === 'history' }]" @click="tab = 'history'">모임별 기록</button>
    </div>

    <div v-if="tab === 'cumulative'" class="card">
      <h2>누적 랭킹</h2>
      <p class="dim">1등 10점 ~ 최소 1점 합산 기준</p>
      <div v-if="store.cumulativeRanking.length === 0" class="empty">아직 집계된 기록이 없어요.</div>
      <div v-for="(r, i) in store.cumulativeRanking" :key="r.id" class="list-row">
        <span class="rank-num" :class="{ top: i < 3 }">{{ i + 1 }}</span>
        <span class="row-name">{{ r.name }}</span>
        <span class="dim">{{ r.games }}경기 · {{ r.wins }}승</span>
        <span class="row-points">{{ r.points }}점</span>
      </div>
    </div>

    <div v-if="tab === 'history'">
      <div v-if="store.doneMeetings.length === 0" class="card empty">완료된 모임 기록이 없어요.</div>
      <div v-for="mt in store.doneMeetings" :key="mt.id" class="card">
        <h2>{{ mt.title }}</h2>
        <p class="dim">{{ mt.meet_date }} · {{ mt.meet_time }}</p>
        <div v-if="mt.total_fee" class="fee-summary">
          총 식대 <strong>{{ Number(mt.total_fee).toLocaleString() }}원</strong>
        </div>
        <div v-if="scoresOf(mt.id).length === 0" class="empty">기록 없음</div>
        <div v-for="s in scoresOf(mt.id)" :key="s.id" class="list-row">
          <span class="rank-num" :class="{ top: s.rank === 1 }">{{ s.rank }}등</span>
          <span class="row-name">{{ s.name }}</span>
          <span class="dim score-net">핸디 {{ s.net }}{{ s.mulligan ? ' (멀리건)' : '' }}</span>
          <span v-if="s.fee_amount != null" class="row-fee">{{ Number(s.fee_amount).toLocaleString() }}원</span>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.page { max-width: 640px; margin: 0 auto; padding: 2rem 1.5rem; }
h1 { font-size: 1.6rem; font-weight: 800; color: #eaf2e6; margin: 0 0 1.25rem; }

.tabs { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; }
.tab {
  padding: 0.4rem 1.1rem;
  border: 1px solid #2c4a33;
  border-radius: 20px;
  background: transparent;
  color: #9db39e;
  cursor: pointer;
  font-size: 0.9rem;
}
.tab.active { background: #4e9a51; color: #fff; border-color: #4e9a51; font-weight: 700; }

.card {
  background: #16271a;
  border: 1px solid #2c4a33;
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1rem;
}
.card h2 { font-size: 1rem; font-weight: 700; color: #eaf2e6; margin: 0 0 0.25rem; }
.dim { color: #9db39e; font-size: 0.82rem; }
.empty { color: #9db39e; font-size: 0.875rem; padding: 1rem 0; text-align: center; }

.list-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.6rem 0;
  border-top: 1px solid #2c4a33;
}

.rank-num { width: 28px; font-weight: 700; color: #9db39e; font-size: 0.9rem; flex-shrink: 0; }
.rank-num.top { color: #6fbf6f; }
.row-name { flex: 1; font-weight: 600; color: #eaf2e6; font-size: 0.95rem; }
.row-points { font-weight: 800; color: #6fbf6f; font-size: 0.95rem; }
.row-fee { font-weight: 700; color: #6fbf6f; font-size: 0.9rem; margin-left: auto; }
.score-net { font-size: 0.8rem; }
.fee-summary { background: #1d3324; border: 1px solid #2c4a33; border-radius: 8px; padding: 0.6rem 0.9rem; font-size: 0.88rem; color: #9db39e; margin-bottom: 0.75rem; }
.fee-summary strong { color: #eaf2e6; }
</style>
