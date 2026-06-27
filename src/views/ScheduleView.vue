<script setup>
import { ref } from 'vue'
import { useGolfStore } from '@/stores/golf'

const store = useGolfStore()
const selectedMember = ref('')
const msg = ref('')

function onSelectMember(id) {
  selectedMember.value = id
  if (id) store.logAccess(Number(id))
}

function toggleAttend(meeting) {
  if (!selectedMember.value) { msg.value = '먼저 본인 이름을 선택하세요.'; return }
  msg.value = ''
  const ok = store.toggleAttend(meeting.id, Number(selectedMember.value))
  if (ok === false) msg.value = '정원이 가득 찼어요.'
}

function attendeesOf(meetingId) {
  return store.attendances
    .filter(a => a.meeting_id === meetingId)
    .map(a => store.members.find(m => m.id === a.member_id)?.name)
    .filter(Boolean)
}
</script>

<template>
  <main class="page">
    <h1>일정 · 참석 신청</h1>

    <div class="card">
      <h2>본인 선택</h2>
      <p class="dim">참석 신청을 하려면 먼저 본인 이름을 골라주세요.</p>
      <select :value="selectedMember" @change="onSelectMember($event.target.value)">
        <option value="">이름 선택…</option>
        <option v-for="m in store.members.filter(m => m.active)" :key="m.id" :value="m.id">
          {{ m.name }} (핸디 {{ m.handicap }})
        </option>
      </select>
      <p v-if="msg" class="error">{{ msg }}</p>
    </div>

    <div v-if="store.upcomingMeetings.length === 0" class="card dim-center">
      예정된 모임이 아직 없어요.
    </div>

    <div v-for="mt in store.upcomingMeetings" :key="mt.id" class="meeting-card">
      <div class="meeting-top">
        <div>
          <div class="meeting-title">{{ mt.title }}</div>
          <div class="meeting-meta">{{ mt.meet_date }} · {{ mt.meet_time }}</div>
        </div>
        <span class="badge" :class="{ full: store.attendCount(mt.id) >= mt.capacity && !store.isAttending(mt.id, Number(selectedMember)) }">
          {{ store.attendCount(mt.id) }}/{{ mt.capacity }}명
        </span>
      </div>

      <button
        :class="['btn-attend', { joined: store.isAttending(mt.id, Number(selectedMember)) }]"
        :disabled="store.attendCount(mt.id) >= mt.capacity && !store.isAttending(mt.id, Number(selectedMember))"
        @click="toggleAttend(mt)"
      >
        {{
          store.isAttending(mt.id, Number(selectedMember)) ? '참석 취소'
          : store.attendCount(mt.id) >= mt.capacity ? '정원 마감'
          : '참석 신청'
        }}
      </button>

      <div v-if="attendeesOf(mt.id).length" class="attendees">
        참석자: {{ attendeesOf(mt.id).join(', ') }}
      </div>
    </div>
  </main>
</template>

<style scoped>
.page { max-width: 640px; margin: 0 auto; padding: 2rem 1.5rem; }
h1 { font-size: 1.6rem; font-weight: 800; color: #eaf2e6; margin: 0 0 1.5rem; }

.card {
  background: #16271a;
  border: 1px solid #2c4a33;
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1rem;
}
.card h2 { font-size: 1rem; font-weight: 700; color: #eaf2e6; margin: 0 0 0.4rem; }
.dim { color: #9db39e; font-size: 0.875rem; margin-bottom: 0.75rem; }
.dim-center { color: #9db39e; font-size: 0.875rem; text-align: center; padding: 1.5rem 0; }

select {
  width: 100%;
  background: #0f1b12;
  border: 1px solid #2c4a33;
  border-radius: 8px;
  padding: 0.6rem 0.75rem;
  color: #eaf2e6;
  font-size: 0.95rem;
}

.error { color: #e8543e; font-size: 0.85rem; margin: 0.5rem 0 0; }

.meeting-card {
  background: #16271a;
  border: 1px solid #2c4a33;
  border-radius: 12px;
  padding: 1.25rem;
  margin-bottom: 1rem;
}

.meeting-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 1rem;
}

.meeting-title { font-weight: 700; color: #eaf2e6; font-size: 1rem; }
.meeting-meta { color: #9db39e; font-size: 0.85rem; margin-top: 0.25rem; }

.badge {
  background: #2c4a33;
  color: #eaf2e6;
  font-size: 0.8rem;
  padding: 0.25rem 0.65rem;
  border-radius: 20px;
  font-weight: 600;
  white-space: nowrap;
}
.badge.full { background: #e8543e; color: #fff; }

.btn-attend {
  width: 100%;
  padding: 0.65rem;
  border: none;
  border-radius: 8px;
  font-weight: 700;
  font-size: 0.95rem;
  cursor: pointer;
  background: #4e9a51;
  color: #fff;
}
.btn-attend.joined {
  background: transparent;
  border: 2px solid #2c4a33;
  color: #9db39e;
}
.btn-attend:disabled {
  background: #2c4a33;
  color: #9db39e;
  cursor: not-allowed;
}

.attendees {
  margin-top: 0.75rem;
  font-size: 0.8rem;
  color: #9db39e;
}
</style>
