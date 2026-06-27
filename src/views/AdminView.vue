<script setup>
import { ref, computed, watch } from 'vue'
import { useGolfStore } from '@/stores/golf'

const store = useGolfStore()
const tab = ref('members')
watch(tab, (val) => { if (val === 'logs') store.fetchAccessLogs() })
const ADMIN_PW = 'golf1234'
const pw = ref('')
const authed = ref(false)
const authErr = ref('')

function tryLogin() {
  if (pw.value === ADMIN_PW) { authed.value = true; authErr.value = '' }
  else authErr.value = '비밀번호가 틀렸어요.'
}

// 회원
const newName = ref(''); const newHc = ref('')
function addMember() {
  if (!newName.value.trim()) return
  store.addMember(newName.value.trim(), newHc.value)
  newName.value = ''; newHc.value = ''
}

const editingId = ref(null)
const editName = ref(''); const editHc = ref('')
function startEdit(m) { editingId.value = m.id; editName.value = m.name; editHc.value = m.handicap }
function confirmEdit() {
  if (!editName.value.trim()) return
  store.updateMember(editingId.value, editName.value.trim(), editHc.value)
  editingId.value = null
}
function cancelEdit() { editingId.value = null }

// 모임
const mtTitle = ref(''); const mtDate = ref(''); const mtTime = ref('15:00')
function addMeeting() {
  if (!mtTitle.value.trim() || !mtDate.value) return
  store.addMeeting(mtTitle.value.trim(), mtDate.value, mtTime.value)
  mtTitle.value = ''; mtDate.value = ''
}

const editingMtId = ref(null)
const editMtTitle = ref(''); const editMtDate = ref(''); const editMtTime = ref('')
function startEditMeeting(mt) {
  editingMtId.value = mt.id
  editMtTitle.value = mt.title
  editMtDate.value = mt.meet_date
  editMtTime.value = mt.meet_time
}
async function confirmEditMeeting() {
  if (!editMtTitle.value.trim() || !editMtDate.value) return
  await store.updateMeeting(editingMtId.value, editMtTitle.value.trim(), editMtDate.value, editMtTime.value)
  editingMtId.value = null
}
function cancelEditMeeting() { editingMtId.value = null }

const autoGenYear = ref(new Date().getFullYear())
const autoGenMsg = ref('')
function generateSchedule() {
  const added = store.generateYearSchedule(Number(autoGenYear.value))
  autoGenMsg.value = added > 0 ? `${added}개 일정이 추가됐어요.` : '이미 모두 등록된 일정이에요.'
  setTimeout(() => { autoGenMsg.value = '' }, 3000)
}

// 조편성
const selMeeting = ref('')
const selMeetingAtts = computed(() =>
  store.attendances.filter(a => a.meeting_id === Number(selMeeting.value))
)
const teamA = computed(() => selMeetingAtts.value.filter(a => a.team === 'A'))
const teamB = computed(() => selMeetingAtts.value.filter(a => a.team === 'B'))
function nameOf(id) { return store.members.find(m => m.id === id)?.name || '?' }

// 스코어
const selScore = ref('')
const scoreInputs = ref({})
const totalFee = ref('')
const preview = ref([])
const saved = ref(false)

const scoreAtts = computed(() =>
  store.attendances.filter(a => a.meeting_id === Number(selScore.value))
)

function buildEntries() {
  return scoreAtts.value.map(a => {
    const m = store.members.find(mb => mb.id === a.member_id)
    const inp = scoreInputs.value[a.member_id] || {}
    const net_input = parseFloat(inp.net_input)
    if (isNaN(net_input)) return null
    return {
      member_id: a.member_id,
      name: m?.name,
      net_input,
      mulligan: !!inp.mulligan,
    }
  }).filter(Boolean)
}

function doPreview() {
  const entries = buildEntries()
  if (!entries.length) return
  const n = entries.length
  const withNet = entries
    .map(e => ({ ...e, net: e.net_input + (e.mulligan ? 1 : 0) }))
    .sort((a, b) => a.net - b.net)
  const raw = n === 1 ? [1] : withNet.map((_, i) => 5 + 10 * (i / (n - 1)))
  const sum = raw.reduce((a, b) => a + b, 0)
  const ratios = raw.map(r => r / sum)
  const fee = parseFloat(totalFee.value) || 0
  preview.value = withNet.map((e, i) => ({
    ...e, rank: i + 1, ratio: ratios[i],
    fee_amount: fee ? Math.round(fee * ratios[i] / 100) * 100 : null,
  }))
}

function saveScores() {
  const entries = buildEntries()
  if (!entries.length) return
  store.saveScores(Number(selScore.value), entries, parseFloat(totalFee.value) || 0)
  saved.value = true
}
</script>

<template>
  <main class="page">
    <h1>관리자</h1>

    <div v-if="!authed" class="card">
      <h2>운영진 로그인</h2>
      <p class="dim">운영 비밀번호를 입력하세요.</p>
      <input type="password" v-model="pw" placeholder="비밀번호" @keydown.enter="tryLogin" />
      <p v-if="authErr" class="error">{{ authErr }}</p>
      <button class="btn" style="margin-top:0.75rem" @click="tryLogin">로그인</button>
    </div>

    <template v-else>
      <div class="tabs">
        <button v-for="[k, label] in [['members','회원'],['meetings','모임'],['teams','조편성'],['scores','스코어·정산'],['logs','접속로그']]"
          :key="k" :class="['tab', { active: tab === k }]" @click="tab = k">{{ label }}</button>
      </div>

      <!-- 회원 관리 -->
      <div v-if="tab === 'members'" class="card">
        <h2>회원 관리</h2>
        <div class="row-input">
          <input v-model="newName" placeholder="이름" style="flex:2" />
          <input v-model="newHc" type="number" placeholder="핸디" style="flex:1" />
          <button class="btn btn-sm" @click="addMember">추가</button>
        </div>
        <div v-if="store.members.length === 0" class="empty">등록된 회원이 없어요.</div>
        <div v-for="m in store.members" :key="m.id" class="list-row">
          <template v-if="editingId === m.id">
            <div class="edit-inline">
              <input v-model="editName" placeholder="이름" style="flex:2" />
              <input v-model="editHc" type="number" placeholder="핸디" style="flex:1;width:70px" />
              <button class="btn-sm btn" @click="confirmEdit">저장</button>
              <button class="btn-ghost" @click="cancelEdit">취소</button>
            </div>
          </template>
          <template v-else>
            <b>{{ m.name }}</b>
            <span class="row-right">
              <span class="dim">핸디 {{ m.handicap }}</span>
              <button class="btn-ghost" @click="startEdit(m)">수정</button>
              <button class="btn-ghost btn-del" @click="store.deleteMember(m.id)">삭제</button>
            </span>
          </template>
        </div>
      </div>

      <!-- 모임 관리 -->
      <div v-if="tab === 'meetings'" class="card">
        <h2>모임 관리</h2>

        <div class="auto-gen-box">
          <p class="dim" style="margin:0 0 0.5rem">매월 2째·4째 일요일 정기모임을 자동 생성합니다.</p>
          <div class="row-input" style="margin-top:0">
            <input v-model="autoGenYear" type="number" style="width:110px;flex:none" />
            <button class="btn btn-sm" @click="generateSchedule">연간 일정 자동 생성</button>
          </div>
          <p v-if="autoGenMsg" class="success" style="margin-top:0.5rem">{{ autoGenMsg }}</p>
        </div>

        <div class="col-input">
          <input v-model="mtTitle" placeholder="제목 (예: 6월 둘째 주 정기모임)" />
          <div class="row-input" style="margin-top:0">
            <input v-model="mtDate" type="date" />
            <input v-model="mtTime" type="time" />
          </div>
          <button class="btn" @click="addMeeting">모임 만들기</button>
        </div>
        <div v-if="store.meetings.length === 0" class="empty">모임이 없어요.</div>
        <div v-for="mt in [...store.meetings].sort((a,b) => b.meet_date.localeCompare(a.meet_date))" :key="mt.id" class="list-row">
          <template v-if="editingMtId === mt.id">
            <div class="edit-inline" style="flex-direction:column;gap:0.4rem">
              <input v-model="editMtTitle" placeholder="제목" />
              <div class="row-input" style="margin-top:0">
                <input v-model="editMtDate" type="date" />
                <input v-model="editMtTime" type="time" />
              </div>
              <div style="display:flex;gap:0.5rem">
                <button class="btn btn-sm" @click="confirmEditMeeting">저장</button>
                <button class="btn-ghost" @click="cancelEditMeeting">취소</button>
              </div>
            </div>
          </template>
          <template v-else>
            <span>
              <b>{{ mt.title }}</b><br>
              <span class="dim">{{ mt.meet_date }} · {{ mt.meet_time }} · {{ mt.status }}</span>
            </span>
            <span style="display:flex;gap:0.5rem">
              <button class="btn-ghost" @click="startEditMeeting(mt)">수정</button>
              <button class="btn-ghost btn-del" @click="store.deleteMeeting(mt.id)">삭제</button>
            </span>
          </template>
        </div>
      </div>

      <!-- 조 편성 -->
      <div v-if="tab === 'teams'" class="card">
        <h2>랜덤 조 편성</h2>
        <select v-model="selMeeting">
          <option value="">모임 선택…</option>
          <option v-for="mt in store.meetings" :key="mt.id" :value="mt.id">{{ mt.title }} ({{ mt.meet_date }})</option>
        </select>
        <template v-if="selMeeting">
          <p class="dim" style="margin:0.75rem 0 0">참석 신청 {{ selMeetingAtts.length }}명</p>
          <button class="btn" @click="store.assignTeams(Number(selMeeting))">
            {{ teamA.length || teamB.length ? '다시 섞기' : '2개 조로 편성' }}
          </button>
          <div v-if="teamA.length || teamB.length" class="team-grid">
            <div class="team-box">
              <b class="team-label green">1번방 · {{ teamA.length }}명</b>
              <div v-for="a in teamA" :key="a.id" class="team-member">{{ nameOf(a.member_id) }}</div>
            </div>
            <div class="team-box">
              <b class="team-label red">2번방 · {{ teamB.length }}명</b>
              <div v-for="a in teamB" :key="a.id" class="team-member">{{ nameOf(a.member_id) }}</div>
            </div>
          </div>
        </template>
      </div>

      <!-- 스코어 입력 -->
      <div v-if="tab === 'scores'" class="card">
        <h2>스코어 입력 · 정산</h2>
        <select v-model="selScore" @change="scoreInputs={}; preview=[]; saved=false">
          <option value="">모임 선택…</option>
          <option v-for="mt in store.meetings" :key="mt.id" :value="mt.id">{{ mt.title }} ({{ mt.meet_date }})</option>
        </select>

        <p v-if="selScore && scoreAtts.length === 0" class="dim" style="margin-top:0.75rem">참석자가 없습니다.</p>

        <template v-if="selScore && scoreAtts.length">
          <div class="score-list">
            <div v-for="a in scoreAtts" :key="a.id" class="score-row">
              <span class="score-name">{{ nameOf(a.member_id) }}</span>
              <input type="number" placeholder="핸디점수"
                :value="scoreInputs[a.member_id]?.net_input ?? ''"
                @input="scoreInputs[a.member_id] = { ...scoreInputs[a.member_id], net_input: $event.target.value }" />
              <button
                :class="['btn-mulligan', { active: scoreInputs[a.member_id]?.mulligan }]"
                @click="scoreInputs[a.member_id] = { ...scoreInputs[a.member_id], mulligan: !scoreInputs[a.member_id]?.mulligan }">
                멀리건
              </button>
            </div>
          </div>

          <div class="row-input" style="margin-top:1rem">
            <input v-model="totalFee" type="number" placeholder="총 식대 금액 (원)" />
            <button class="btn-ghost" @click="doPreview">미리보기</button>
          </div>

          <div v-if="preview.length" class="preview-box">
            <b class="dim" style="font-size:0.8rem">정산 결과</b>
            <div v-for="r in preview" :key="r.member_id" class="preview-row">
              <span :class="['pr-rank', { top: r.rank === 1 }]">{{ r.rank }}등</span>
              <span class="pr-name">{{ r.name }}</span>
              <span class="dim" style="font-size:0.78rem">순 {{ r.net }}</span>
              <span class="dim" style="font-size:0.78rem;width:44px;text-align:right">{{ (r.ratio * 100).toFixed(1) }}%</span>
              <span class="pr-fee">{{ r.fee_amount != null ? r.fee_amount.toLocaleString() + '원' : '-' }}</span>
            </div>
          </div>

          <button class="btn" style="margin-top:1rem" @click="saveScores">저장하기 (순위표에 반영)</button>
          <p v-if="saved" class="success">저장 완료! 순위표에 반영됐어요.</p>
        </template>
      </div>
      <!-- 접속 로그 -->
      <div v-if="tab === 'logs'" class="card">
        <h2>접속 로그</h2>
        <p class="dim">일정 화면에서 본인 이름을 선택한 기록입니다.</p>
        <div v-if="store.accessLogs.length === 0" class="empty">아직 접속 기록이 없어요.</div>
        <div v-for="log in store.accessLogs" :key="log.id" class="list-row">
          <span><b>{{ log.name }}</b></span>
          <span class="dim">{{ new Date(log.created_at).toLocaleString('ko-KR') }}</span>
        </div>
        <button v-if="store.accessLogs.length" class="btn-ghost" style="margin-top:0.75rem;width:100%" @click="store.clearAccessLogs()">로그 전체 삭제</button>
      </div>

    </template>
  </main>
</template>

<style scoped>
.page { max-width: 640px; margin: 0 auto; padding: 2rem 1.5rem; }
h1 { font-size: 1.6rem; font-weight: 800; color: #eaf2e6; margin: 0 0 1.25rem; }

.card { background: #16271a; border: 1px solid #2c4a33; border-radius: 12px; padding: 1.25rem; margin-bottom: 1rem; }
.card h2 { font-size: 1rem; font-weight: 700; color: #eaf2e6; margin: 0 0 0.75rem; }
.dim { color: #9db39e; font-size: 0.875rem; }
.error { color: #e8543e; font-size: 0.85rem; margin: 0.5rem 0 0; }
.success { color: #6fbf6f; font-size: 0.85rem; margin: 0.5rem 0 0; text-align: center; }
.empty { color: #9db39e; font-size: 0.875rem; padding: 0.75rem 0; }

input, select {
  width: 100%;
  background: #0f1b12;
  border: 1px solid #2c4a33;
  border-radius: 8px;
  padding: 0.6rem 0.75rem;
  color: #eaf2e6;
  font-size: 0.9rem;
  box-sizing: border-box;
}

.tabs { display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap; }
.tab { padding: 0.4rem 1rem; border: 1px solid #2c4a33; border-radius: 20px; background: transparent; color: #9db39e; cursor: pointer; font-size: 0.88rem; }
.tab.active { background: #4e9a51; color: #fff; border-color: #4e9a51; font-weight: 700; }

.btn { display: block; width: 100%; margin-top: 0.75rem; padding: 0.65rem; background: #4e9a51; color: #fff; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 0.95rem; }
.btn-sm { width: auto; padding: 0.6rem 1rem; margin-top: 0; flex-shrink: 0; }
.btn-ghost { background: transparent; border: 1px solid #2c4a33; color: #9db39e; border-radius: 6px; padding: 0.4rem 0.8rem; cursor: pointer; font-size: 0.85rem; white-space: nowrap; }

.row-input { display: flex; gap: 0.5rem; align-items: center; margin-top: 0.75rem; }
.row-input input { margin-top: 0; }
.col-input { display: flex; flex-direction: column; gap: 0.5rem; }

.list-row { display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0; border-top: 1px solid #2c4a33; }
.list-row b { color: #eaf2e6; }
.row-right { display: flex; align-items: center; gap: 0.75rem; }
.edit-inline { display: flex; gap: 0.5rem; align-items: center; width: 100%; }
.edit-inline input { margin-top: 0; padding: 0.45rem 0.6rem; }
.btn-del { color: #e8543e; border-color: #e8543e33; }

.team-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 1rem; }
.team-box { background: #1d3324; border: 1px solid #2c4a33; border-radius: 10px; padding: 0.875rem; }
.team-label { display: block; margin-bottom: 0.5rem; font-size: 0.9rem; }
.team-label.green { color: #6fbf6f; }
.team-label.red { color: #e8543e; }
.team-member { padding: 0.4rem 0; border-top: 1px solid #2c4a33; font-size: 0.875rem; color: #eaf2e6; }

.score-list { display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.75rem; }
.score-row { display: flex; align-items: center; gap: 0.5rem; background: #1d3324; border: 1px solid #2c4a33; border-radius: 8px; padding: 0.6rem 0.75rem; }
.score-name { flex: 1; font-weight: 600; color: #eaf2e6; font-size: 0.9rem; }
.score-row input { width: 80px; padding: 0.45rem 0.5rem; }
.btn-mulligan { background: transparent; border: 1px solid #2c4a33; color: #9db39e; border-radius: 6px; padding: 0.4rem 0.65rem; cursor: pointer; font-size: 0.78rem; white-space: nowrap; }
.btn-mulligan.active { background: #e8543e; border-color: #e8543e; color: #fff; }

.auto-gen-box { background: #1d3324; border: 1px solid #2c4a33; border-radius: 10px; padding: 0.875rem; margin-bottom: 1rem; }
.preview-box { margin-top: 1rem; background: #1d3324; border: 1px solid #2c4a33; border-radius: 10px; padding: 0.875rem; }
.preview-row { display: flex; align-items: center; gap: 0.6rem; padding: 0.45rem 0; border-top: 1px solid #2c4a33; }
.pr-rank { width: 30px; font-weight: 700; color: #9db39e; font-size: 0.85rem; flex-shrink: 0; }
.pr-rank.top { color: #6fbf6f; }
.pr-name { flex: 1; font-weight: 600; color: #eaf2e6; font-size: 0.88rem; }
.pr-fee { width: 80px; text-align: right; font-weight: 700; color: #eaf2e6; font-size: 0.85rem; }
</style>
