<script setup>
import { ref, computed, watch } from 'vue'
import { useGolfStore } from '@/stores/golf'
import { shareMessage } from '@/lib/kakao'

const store = useGolfStore()
const tab = ref('members')
watch(tab, (val) => {
  if (val === 'logs') store.fetchAccessLogs()
  if (val === 'finance') store.fetchTransactions()
})
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

watch(tab, (val) => {
  if (val === 'teams' && !selMeeting.value && store.meetings.length) {
    const today = new Date().toISOString().slice(0, 10)
    const past = store.meetings.filter(m => m.meet_date <= today).sort((a, b) => b.meet_date.localeCompare(a.meet_date))
    const pick = past[0] || [...store.meetings].sort((a, b) => a.meet_date.localeCompare(b.meet_date))[0]
    if (pick) selMeeting.value = pick.id
  }
})
const selMeetingAtts = computed(() =>
  store.attendances.filter(a => a.meeting_id === Number(selMeeting.value))
)
const teamA = computed(() => selMeetingAtts.value.filter(a => a.team === 'A'))
const teamB = computed(() => selMeetingAtts.value.filter(a => a.team === 'B'))
function nameOf(id) { return store.members.find(m => m.id === id)?.name || '?' }

// 스코어
const selScore = ref('')

// 스코어 탭 진입 시 오늘 이전 가장 최근 모임 자동 선택
watch(tab, (val) => {
  if (val === 'scores' && !selScore.value && store.meetings.length) {
    const today = new Date().toISOString().slice(0, 10)
    const past = store.meetings.filter(m => m.meet_date <= today).sort((a, b) => b.meet_date.localeCompare(a.meet_date))
    const pick = past[0] || [...store.meetings].sort((a, b) => a.meet_date.localeCompare(b.meet_date))[0]
    if (pick) selScore.value = pick.id
  }
})
const scoreInputs = ref({})
const scoreSaved = ref(false)
const reEntering = ref(false)

// 정산
const totalFee = ref('')
const feePreview = ref([])
const feeSaved = ref(false)
const kakaoStatus = ref('')

const scoreAtts = computed(() =>
  store.attendances.filter(a => a.meeting_id === Number(selScore.value))
)

// 이미 스코어가 저장된 모임인지
const existingScores = computed(() =>
  store.scores.filter(s => s.meeting_id === Number(selScore.value) && s.rank != null)
    .sort((a, b) => a.rank - b.rank)
    .map(s => ({ ...s, name: store.members.find(m => m.id === s.member_id)?.name || '?' }))
)
const hasScores = computed(() => existingScores.value.length > 0)

function buildEntries() {
  return scoreAtts.value.map(a => {
    const m = store.members.find(mb => mb.id === a.member_id)
    const inp = scoreInputs.value[a.member_id] || {}
    const net_input = parseFloat(inp.net_input)
    if (isNaN(net_input)) return null
    return { member_id: a.member_id, name: m?.name, net_input, mulligan: !!inp.mulligan }
  }).filter(Boolean)
}

const scoreError = ref('')
async function saveScores() {
  const entries = buildEntries()
  if (!entries.length) { scoreError.value = '스코어를 입력해주세요.'; return }
  scoreError.value = ''
  const err = await store.saveScores(Number(selScore.value), entries, null)
  if (err) { scoreError.value = '저장 실패: ' + (err.message || JSON.stringify(err)); return }
  reEntering.value = false
  scoreSaved.value = true
}

const MAX_LAST_FEE = 50000

function doFeePreview() {
  const scores = existingScores.value
  if (!scores.length) return
  const fee = parseFloat(totalFee.value) || 0
  const n = scores.length
  // 꼴등이 MAX_LAST_FEE 초과 시 max_raw를 동적으로 줄여 비율 전체 조정
  // max_raw = 125000n / (fee - 25000n) 으로 꼴등이 정확히 5만원
  let maxRaw = 15
  if (n > 1 && fee > 0) {
    const denom = fee - 25000 * n
    if (denom > 0) maxRaw = Math.min(15, 125000 * n / denom)
  }
  const raw = n === 1 ? [1] : scores.map((_, i) => 5 + (maxRaw - 5) * (i / (n - 1)))
  const sum = raw.reduce((a, b) => a + b, 0)
  const ratios = raw.map(r => r / sum)
  const amounts = ratios.map(r => fee ? Math.round(fee * r / 100) * 100 : null)

  // 반올림 차이를 꼴등에서 조정
  if (fee && amounts.length) {
    const total = amounts.reduce((a, b) => a + b, 0)
    amounts[amounts.length - 1] -= (total - fee)
  }

  feePreview.value = scores.map((s, i) => ({
    ...s, ratio: ratios[i],
    fee_amount: amounts[i],
  }))
}

async function saveFee() {
  const fee = parseFloat(totalFee.value) || 0
  await store.updateMeetingFee(Number(selScore.value), fee, feePreview.value)
  feeSaved.value = true
}

// 회비 - 회원 납부
const finTab = ref('payment')
const txRows = computed(() => {
  const sorted = [...store.transactions].reverse()
  let running = 0
  return sorted.map(t => {
    running += (t.income || 0) - (t.expense || 0)
    return { ...t, balance: running }
  }).reverse()
})
const editingTxId = ref(null)
const editTxMemo = ref('')
function startEditTx(t) { editingTxId.value = t.id; editTxMemo.value = t.memo || '' }
async function confirmEditTx(t) {
  await store.updateTransactionMemo(t.id, editTxMemo.value)
  editingTxId.value = null
}

const payMeeting = ref('')
const payAmounts = ref({})  // member_id -> amount
const payBulk = ref('')
const paySaving = ref(false)

const payMeetingAtts = computed(() => {
  if (!payMeeting.value) return []
  return store.attendances
    .filter(a => a.meeting_id === Number(payMeeting.value))
    .map(a => ({ ...a, name: store.members.find(m => m.id === a.member_id)?.name || '?' }))
})

function applyBulk() {
  if (!payBulk.value) return
  payMeetingAtts.value.forEach(a => {
    payAmounts.value[a.member_id] = payBulk.value
  })
}

async function savePayments() {
  const mt = store.meetings.find(m => m.id === Number(payMeeting.value))
  const date = mt?.meet_date || new Date().toISOString().slice(0, 10)
  const entries = payMeetingAtts.value
    .filter(a => payAmounts.value[a.member_id])
    .map(a => ({
      date,
      description: a.name,
      income: payAmounts.value[a.member_id],
      expense: null,
      memo: mt?.title || '',
    }))
  if (!entries.length) return
  paySaving.value = true
  for (const e of entries) await store.addTransaction(e)
  paySaving.value = false
  payAmounts.value = {}; payBulk.value = ''
}

// 회비 - 지출
const expMeeting = ref('')
const expDate = ref(new Date().toISOString().slice(0, 10))
const expDesc = ref('')
const expAmount = ref('')
const expMemo = ref('')

function onExpMeetingChange() {
  const mt = store.meetings.find(m => m.id === Number(expMeeting.value))
  if (mt) {
    expDate.value = mt.meet_date
    expMemo.value = mt.title
  } else {
    expMemo.value = ''
  }
}

async function saveExpense() {
  if (!expDesc.value.trim() || !expAmount.value) return
  await store.addTransaction({
    date: expDate.value,
    description: expDesc.value.trim(),
    income: null,
    expense: expAmount.value,
    memo: expMemo.value.trim() || null,
  })
  expMeeting.value = ''; expDesc.value = ''; expAmount.value = ''; expMemo.value = ''
  expDate.value = new Date().toISOString().slice(0, 10)
}

async function shareToKakao() {
  const mt = store.meetings.find(m => m.id === Number(selScore.value))
  const fee = parseFloat(totalFee.value) || 0
  const lines = feePreview.value.map(r =>
    `${r.rank}등 ${r.name}  ${r.fee_amount != null ? r.fee_amount.toLocaleString() + '원' : '-'}`
  )
  const text = [
    `🏌️ ${mt?.title || '모임'} 식대 정산`,
    `총 식대: ${fee.toLocaleString()}원`,
    '',
    ...lines,
    '',
    '자세히 보기 → agit-golf-app.vercel.app/ranking',
  ].join('\n')

  kakaoStatus.value = '공유 중...'
  try {
    const result = await shareMessage(text)
    kakaoStatus.value = result === 'shared' ? '공유 완료! 📤' : '클립보드에 복사됐어요! 붙여넣기 해주세요. 📋'
  } catch (e) {
    kakaoStatus.value = '공유 취소됨'
  }
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
        <button v-for="[k, label] in [['members','회원'],['meetings','모임'],['teams','조편성'],['scores','스코어·정산'],['finance','회비'],['logs','접속로그']]"
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
        <h2>조 편성</h2>
        <select v-model="selMeeting">
          <option value="">모임 선택…</option>
          <option v-for="mt in store.meetings" :key="mt.id" :value="mt.id">{{ mt.title }} ({{ mt.meet_date }})</option>
        </select>
        <template v-if="selMeeting">
          <p class="dim" style="margin:0.75rem 0 0">참석 신청 {{ selMeetingAtts.length }}명</p>
          <button class="btn" @click="store.assignTeams(Number(selMeeting))">
            {{ teamA.length || teamB.length ? '🎲 다시 섞기' : '🎲 랜덤 편성' }}
          </button>

          <!-- 수동 편집 -->
          <div v-if="selMeetingAtts.length" style="margin-top:1rem">
            <p class="dim" style="margin:0 0 0.5rem">팀을 직접 변경할 수 있어요.</p>
            <div v-for="a in selMeetingAtts" :key="a.id" class="team-edit-row">
              <span class="team-edit-name">{{ nameOf(a.member_id) }}</span>
              <div class="team-btn-group">
                <button :class="['team-btn', { active: a.team === 'A' }]" @click="store.setMemberTeam(a.id, 'A')">1번방</button>
                <button :class="['team-btn team-btn-b', { active: a.team === 'B' }]" @click="store.setMemberTeam(a.id, 'B')">2번방</button>
                <button :class="['team-btn team-btn-none', { active: !a.team }]" @click="store.setMemberTeam(a.id, null)">미배정</button>
              </div>
            </div>
          </div>

          <!-- 배정 결과 요약 -->
          <div v-if="teamA.length || teamB.length" class="team-grid" style="margin-top:1rem">
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
        <h2>① 스코어 입력</h2>
        <select v-model="selScore" @change="scoreInputs={}; scoreSaved=false; scoreError=''; reEntering=false; feePreview=[]; feeSaved=false">
          <option value="">모임 선택…</option>
          <option v-for="mt in store.meetings" :key="mt.id" :value="mt.id">{{ mt.title }} ({{ mt.meet_date }})</option>
        </select>

        <p v-if="selScore && scoreAtts.length === 0" class="dim" style="margin-top:0.75rem">참석자가 없습니다.</p>

        <template v-if="selScore && scoreAtts.length">
          <!-- 이미 저장된 스코어가 있으면 표시 -->
          <div v-if="hasScores && !reEntering" class="saved-scores">
            <p class="dim" style="margin:0.75rem 0 0.5rem">저장된 순위</p>
            <div v-for="s in existingScores" :key="s.id" class="preview-row">
              <span :class="['pr-rank', { top: s.rank === 1 }]">{{ s.rank }}등</span>
              <span class="pr-name">{{ s.name }}</span>
              <span class="dim" style="font-size:0.78rem">핸디점수 {{ s.net }}{{ s.mulligan ? ' (멀리건)' : '' }}</span>
            </div>
            <button class="btn-ghost" style="margin-top:0.75rem;width:100%" @click="reEntering=true; scoreSaved=false; scoreInputs={}">다시 입력</button>
          </div>

          <!-- 스코어 입력 폼 -->
          <template v-else>
            <div class="score-list">
              <div v-for="a in scoreAtts" :key="a.id" class="score-row">
                <span class="score-name">{{ nameOf(a.member_id) }}</span>
                <input type="number" step="0.5" placeholder="핸디점수"
                  :value="scoreInputs[a.member_id]?.net_input ?? ''"
                  @input="scoreInputs[a.member_id] = { ...scoreInputs[a.member_id], net_input: $event.target.value }" />
                <button
                  :class="['btn-mulligan', { active: scoreInputs[a.member_id]?.mulligan }]"
                  @click="scoreInputs[a.member_id] = { ...scoreInputs[a.member_id], mulligan: !scoreInputs[a.member_id]?.mulligan }">
                  멀리건
                </button>
              </div>
            </div>
            <button class="btn" style="margin-top:1rem" @click="saveScores">스코어 저장</button>
          </template>
          <p v-if="scoreSaved" class="success" style="margin-top:0.75rem">스코어 저장 완료!</p>
          <p v-if="scoreError" class="error" style="margin-top:0.75rem">{{ scoreError }}</p>
        </template>
      </div>

      <!-- 정산 입력 -->
      <div v-if="tab === 'scores' && selScore && hasScores" class="card">
        <h2>② 식대 정산</h2>
        <div class="row-input">
          <input v-model="totalFee" type="number" placeholder="총 식대 금액 (원)" />
          <button class="btn-ghost" @click="doFeePreview">계산</button>
        </div>

        <div v-if="feePreview.length" class="preview-box">
          <div v-for="r in feePreview" :key="r.member_id" class="preview-row">
            <span :class="['pr-rank', { top: r.rank === 1 }]">{{ r.rank }}등</span>
            <span class="pr-name">{{ r.name }}</span>
            <span class="dim" style="font-size:0.78rem">{{ (r.ratio * 100).toFixed(1) }}%</span>
            <span class="pr-fee">{{ r.fee_amount != null ? r.fee_amount.toLocaleString() + '원' : '-' }}</span>
          </div>
          <button class="btn" style="margin-top:0.75rem;width:100%" @click="saveFee">정산 저장</button>
          <p v-if="feeSaved" class="success">정산 저장 완료! 순위표에 반영됐어요.</p>
          <button v-if="feeSaved" class="btn-kakao" @click="shareToKakao">
            💬 카카오톡으로 공유
          </button>
          <p v-if="kakaoStatus" :class="kakaoStatus.includes('실패') ? 'error' : 'success'">{{ kakaoStatus }}</p>
        </div>
      </div>
      <!-- 회비 관리 -->
      <template v-if="tab === 'finance'">
        <!-- 서브탭 -->
        <div class="tabs" style="margin-bottom:0.75rem">
          <button :class="['tab', { active: finTab === 'payment' }]" @click="finTab='payment'">회원 납부</button>
          <button :class="['tab', { active: finTab === 'expense' }]" @click="finTab='expense'">지출 입력</button>
          <button :class="['tab', { active: finTab === 'history' }]" @click="finTab='history'; store.fetchTransactions()">전체 내역</button>
        </div>

        <!-- 회원 납부 -->
        <div v-if="finTab === 'payment'" class="card">
          <h2>회원 납부 입력</h2>
          <select v-model="payMeeting" @change="payAmounts={}; payBulk=''">
            <option value="">모임 선택…</option>
            <option v-for="mt in store.meetings" :key="mt.id" :value="mt.id">{{ mt.title }} ({{ mt.meet_date }})</option>
          </select>

          <template v-if="payMeeting && payMeetingAtts.length">
            <div class="row-input" style="margin-top:0.75rem">
              <input type="number" v-model="payBulk" placeholder="일괄 금액 입력 (원)" />
              <button class="btn-ghost" @click="applyBulk">전체 적용</button>
            </div>
            <div class="score-list" style="margin-top:0.5rem">
              <div v-for="a in payMeetingAtts" :key="a.id" class="score-row">
                <span class="score-name">{{ a.name }}</span>
                <input type="number" placeholder="납부 금액"
                  :value="payAmounts[a.member_id] ?? ''"
                  @input="payAmounts[a.member_id] = $event.target.value" />
              </div>
            </div>
            <button class="btn" style="margin-top:1rem;width:100%" @click="savePayments" :disabled="paySaving">
              {{ paySaving ? '저장 중…' : '납부 내역 저장' }}
            </button>
          </template>
          <p v-else-if="payMeeting" class="dim" style="margin-top:0.75rem">참석자가 없습니다.</p>
        </div>

        <!-- 지출 입력 -->
        <div v-if="finTab === 'expense'" class="card">
          <h2>지출 입력</h2>
          <div class="finance-form">
            <select v-model="expMeeting" @change="onExpMeetingChange">
              <option value="">모임 선택 (선택사항)</option>
              <option v-for="mt in store.meetings" :key="mt.id" :value="mt.id">{{ mt.title }} ({{ mt.meet_date }})</option>
            </select>
            <input type="date" v-model="expDate" />
            <input type="text" v-model="expDesc" placeholder="내용 (예: 스크린 대여비)" />
            <input type="number" v-model="expAmount" placeholder="금액 (원)" />
            <input type="text" v-model="expMemo" placeholder="메모" />
            <button class="btn" @click="saveExpense">추가</button>
          </div>
        </div>

        <!-- 전체 내역 -->
        <div v-if="finTab === 'history'" class="card">
          <h2>전체 내역</h2>
          <div class="finance-balance">
            <span>현재 잔액</span>
            <strong :style="{ color: store.balance >= 0 ? '#4caf7d' : '#e57373' }">
              {{ store.balance.toLocaleString() }}원
            </strong>
          </div>
          <p v-if="!txRows.length" class="dim">내역이 없습니다.</p>
          <div v-else class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>내용</th>
                  <th>수입</th>
                  <th>지출</th>
                  <th>잔액</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="t in txRows" :key="t.id">
                  <td class="td-date">{{ t.date?.slice(5).replace('-', '/') }}</td>
                  <td class="td-desc">
                    <template v-if="editingTxId === t.id">
                      <input v-model="editTxMemo" placeholder="메모 입력" class="memo-input" @keydown.enter="confirmEditTx(t)" @keydown.esc="editingTxId=null" />
                    </template>
                    <template v-else>
                      {{ t.description }}
                      <span v-if="t.memo" class="td-memo">{{ t.memo }}</span>
                    </template>
                  </td>
                  <td class="td-income">{{ t.income ? Number(t.income).toLocaleString() : '' }}</td>
                  <td class="td-expense">{{ t.expense ? Number(t.expense).toLocaleString() : '' }}</td>
                  <td class="td-balance" :style="{ color: t.balance >= 0 ? '#4caf7d' : '#e57373' }">{{ t.balance.toLocaleString() }}</td>
                  <td style="white-space:nowrap;display:flex;gap:0.3rem">
                    <template v-if="editingTxId === t.id">
                      <button class="btn-ghost" style="padding:0.25rem 0.5rem;font-size:0.8rem" @click="confirmEditTx(t)">저장</button>
                      <button class="btn-ghost" style="padding:0.25rem 0.5rem;font-size:0.8rem" @click="editingTxId=null">취소</button>
                    </template>
                    <template v-else>
                      <button class="btn-ghost" style="padding:0.25rem 0.5rem;font-size:0.8rem" @click="startEditTx(t)">수정</button>
                      <button class="btn-del" style="padding:0.25rem 0.5rem;font-size:0.8rem" @click="store.deleteTransaction(t.id)">삭제</button>
                    </template>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </template>

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
.score-row input { width: 120px; padding: 0.6rem 0.75rem; font-size: 1rem; }
.btn-mulligan { background: transparent; border: 1px solid #2c4a33; color: #9db39e; border-radius: 6px; padding: 0.4rem 0.65rem; cursor: pointer; font-size: 0.78rem; white-space: nowrap; }
.btn-mulligan.active { background: #e8543e; border-color: #e8543e; color: #fff; }

.auto-gen-box { background: #1d3324; border: 1px solid #2c4a33; border-radius: 10px; padding: 0.875rem; margin-bottom: 1rem; }
.preview-box { margin-top: 1rem; background: #1d3324; border: 1px solid #2c4a33; border-radius: 10px; padding: 0.875rem; }
.preview-row { display: flex; align-items: center; gap: 0.6rem; padding: 0.45rem 0; border-top: 1px solid #2c4a33; }
.pr-rank { width: 30px; font-weight: 700; color: #9db39e; font-size: 0.85rem; flex-shrink: 0; }
.pr-rank.top { color: #6fbf6f; }
.pr-name { flex: 1; font-weight: 600; color: #eaf2e6; font-size: 0.88rem; }
.pr-fee { width: 80px; text-align: right; font-weight: 700; color: #eaf2e6; font-size: 0.85rem; }

.btn-kakao { display: block; width: 100%; margin-top: 0.6rem; padding: 0.65rem; background: #FEE500; color: #191919; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 0.95rem; }

.team-edit-row { display: flex; justify-content: space-between; align-items: center; padding: 0.5rem 0; border-top: 1px solid #2c4a33; }
.team-edit-name { font-weight: 600; color: #eaf2e6; font-size: 0.9rem; }
.team-btn-group { display: flex; gap: 0.35rem; }
.team-btn { background: transparent; border: 1px solid #2c4a33; color: #9db39e; border-radius: 6px; padding: 0.3rem 0.6rem; cursor: pointer; font-size: 0.78rem; }
.team-btn.active { background: #4e9a51; border-color: #4e9a51; color: #fff; font-weight: 700; }
.team-btn-b.active { background: #e8543e; border-color: #e8543e; }
.team-btn-none.active { background: #555; border-color: #555; color: #fff; }
.success-card { background: #1a3320; border-color: #4e9a51; color: #6fbf6f; font-weight: 600; text-align: center; }
.error-card { background: #2a1a1a; border-color: #e8543e; color: #e8543e; font-weight: 600; }

.finance-form { display: flex; flex-direction: column; gap: 0.6rem; margin-top: 0.75rem; }
.finance-balance { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: #1d3324; border: 1px solid #2c4a33; border-radius: 10px; margin-bottom: 0.75rem; font-size: 0.95rem; }
.finance-row { display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 0.75rem; background: #16271a; border: 1px solid #2c4a33; border-radius: 8px; margin-bottom: 0.4rem; flex-wrap: wrap; }
.finance-date { font-size: 0.78rem; color: #9db39e; white-space: nowrap; }
.finance-desc-wrap { flex: 1; display: flex; flex-direction: column; gap: 0.1rem; min-width: 80px; }
.finance-desc { font-size: 0.875rem; color: #eaf2e6; }
.finance-memo { font-size: 0.75rem; color: #7a9e80; }
.finance-income { color: #4caf7d; font-weight: 600; font-size: 0.875rem; white-space: nowrap; }
.finance-expense { color: #e8543e; font-weight: 600; font-size: 0.875rem; white-space: nowrap; }
.memo-input { background: #0f1b12; border: 1px solid #4e9a51; border-radius: 6px; padding: 0.3rem 0.5rem; color: #eaf2e6; font-size: 0.82rem; width: 100%; box-sizing: border-box; }
.table-wrap { overflow-x: auto; }
table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
th { text-align: left; color: #9db39e; font-weight: 600; padding: 0.5rem 0.5rem; border-bottom: 1px solid #2c4a33; white-space: nowrap; }
td { padding: 0.55rem 0.5rem; border-bottom: 1px solid #1d3324; vertical-align: middle; }
tr:last-child td { border-bottom: none; }
.td-date { color: #9db39e; white-space: nowrap; }
.td-desc { color: #eaf2e6; }
.td-memo { display: block; font-size: 0.75rem; color: #7a9e80; }
.td-income { color: #4caf7d; font-weight: 600; text-align: right; white-space: nowrap; }
.td-expense { color: #e8543e; font-weight: 600; text-align: right; white-space: nowrap; }
.td-balance { font-weight: 700; text-align: right; white-space: nowrap; }
</style>
