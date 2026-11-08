<script setup>
import { ref, computed, watch } from 'vue'
import { useGolfStore } from '@/stores/golf'
import { useSettingsStore } from '@/stores/settings'
import { useFieldStore, defaultDeadline, defaultGather, localToday } from '@/stores/field'
import { useAdminAuth } from '@/lib/adminAuth'
import RuleLink from '@/components/rules/RuleLink.vue'

const golf = useGolfStore()
const settings = useSettingsStore()
const field = useFieldStore()
const { authed, tryLogin } = useAdminAuth()

const pw = ref('')
const authErr = ref('')
function login() {
  authErr.value = tryLogin(pw.value) ? '' : '비밀번호가 틀렸어요.'
}

const nameOf = id => golf.members.find(m => m.id === id)?.name || '?'

// ── 라운드 만들기·고치기 ──
const editingId = ref(null)
const form = ref(emptyForm())
const touched = ref({ deadline: false, gather: false, title: false })
const formErr = ref('')
const formMsg = ref('')

function emptyForm() {
  return {
    title: '', meet_date: '', meet_time: '', venue: '', venue_address: '',
    teams: Math.round(Number(settings.get('field_capacity_default')) / 4) || 5,
    capacity: Number(settings.get('field_capacity_default')) || 20,
    signup_deadline: '', gather_time: '', notice: '',
  }
}

// 기본값 자동 계산: 마감 = 해당 월 1일, 집결 = 첫 티업 − N분, 제목 = "M월 필드 정기라운드"
watch(() => form.value.meet_date, d => {
  if (!touched.value.deadline) form.value.signup_deadline = defaultDeadline(d)
  if (!touched.value.title && d) form.value.title = `${Number(d.slice(5, 7))}월 필드 정기라운드`
})
watch(() => form.value.meet_time, t => {
  if (!touched.value.gather) form.value.gather_time = defaultGather(t, settings.get('gather_minutes_before'))
})
watch(() => form.value.teams, n => { form.value.capacity = Math.max(0, Number(n) || 0) * 4 })

function startNew() {
  editingId.value = null
  form.value = emptyForm()
  touched.value = { deadline: false, gather: false, title: false }
  formErr.value = ''; formMsg.value = ''
}

function edit(r) {
  editingId.value = r.id
  touched.value = { deadline: true, gather: true, title: true }
  form.value = {
    title: r.title, meet_date: r.meet_date, meet_time: r.meet_time?.slice(0, 5) || '',
    venue: r.venue || '', venue_address: r.venue_address || '',
    teams: Math.ceil(r.capacity / 4), capacity: r.capacity,
    signup_deadline: r.signup_deadline || '', gather_time: r.gather_time?.slice(0, 5) || '', notice: r.notice || '',
  }
  formErr.value = ''; formMsg.value = ''
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

async function save() {
  formErr.value = ''; formMsg.value = ''
  const f = form.value
  if (!f.meet_date || !f.meet_time) { formErr.value = '날짜와 첫 티업 시간을 입력해 주세요.'; return }
  if (!f.title.trim()) { formErr.value = '제목을 입력해 주세요.'; return }
  if (!(Number(f.capacity) > 0)) { formErr.value = '정원을 입력해 주세요.'; return }
  const fields = { ...f, title: f.title.trim(), capacity: Number(f.capacity) }
  delete fields.teams
  const res = editingId.value ? await field.updateRound(editingId.value, fields) : await field.createRound(fields)
  if (res.error) { formErr.value = `저장하지 못했어요: ${res.error}`; return }
  formMsg.value = editingId.value ? '수정했어요.' : '라운드를 만들었어요. 회원이 바로 신청할 수 있어요.'
  if (!editingId.value) startNew()
}

// ── 라운드 상태 ──
const STATUS_LABEL = { open: '신청 중', closed: '신청 마감', done: '완료', canceled: '취소됨' }

async function setStatus(r, status) {
  const label = { closed: '신청을 마감', open: '신청을 다시 열', done: '완료 처리', canceled: '라운드를 취소' }[status]
  if (!confirm(`"${r.title}" ${label}할까요?`)) return
  const err = await field.setRoundStatus(r.id, status)
  if (err) alert(`바꾸지 못했어요: ${err}`)
}

async function remove(r) {
  const n = field.attendancesOf(r.id).length
  if (!confirm(`"${r.title}"을(를) 삭제할까요?${n ? `\n신청 기록 ${n}건도 함께 지워지고 되돌릴 수 없어요.` : ''}`)) return
  const err = await field.deleteRound(r.id)
  if (err) alert(`삭제하지 못했어요: ${err}`)
}

// ── 참석자 관리 ──
const openId = ref(null)
const TIER_LABEL = { free: '위약 없음', mid: '7일 이내', late: '1일 전~당일 (노쇼 기록)' }

async function toggleNoShow(a) {
  const err = await field.setNoShow(a.id, a.status !== 'no_show')
  if (err) alert(err)
}
async function toggleLate(a) {
  const err = await field.setLate(a.id, !a.late)
  if (err) alert(err)
}

const canceledOf = id => field.attendancesOf(id).filter(a => a.status === 'canceled')

// ── 연간 노쇼 (제9조) ──
const year = localToday().slice(0, 4)
const noShowRows = computed(() => {
  const counts = field.noShowCounts(year)
  return Object.entries(counts)
    .map(([id, n]) => ({ id: Number(id), name: nameOf(Number(id)), n }))
    .sort((a, b) => b.n - a.n || a.name.localeCompare(b.name, 'ko'))
})
const noShowLimit = computed(() => Number(settings.get('noshow_limit')))
</script>

<template>
  <main class="page">
    <h1>필드 관리자</h1>

    <div v-if="!authed" class="card">
      <h2>운영진 로그인</h2>
      <p class="dim">운영 비밀번호를 입력하세요.</p>
      <input type="password" v-model="pw" placeholder="비밀번호" @keydown.enter="login" />
      <p v-if="authErr" class="error">{{ authErr }}</p>
      <button class="btn" style="margin-top:0.75rem" @click="login">로그인</button>
    </div>

    <template v-else>
      <p class="dim">회원·회칙 관리는 <RouterLink to="/screen/admin" class="link">공통 관리자 화면</RouterLink>에서 해요.</p>

      <!-- 라운드 만들기 -->
      <section class="card">
        <div class="row-between">
          <h2>{{ editingId ? '라운드 수정' : '라운드 만들기' }}</h2>
          <button v-if="editingId" class="btn-ghost sm" @click="startNew">새로 만들기</button>
        </div>
        <div class="grid">
          <label>날짜<input v-model="form.meet_date" type="date" /></label>
          <label>첫 티업<input v-model="form.meet_time" type="time" /></label>
          <label>집결 <span class="hint">티업 {{ settings.get('gather_minutes_before') }}분 전</span>
            <input v-model="form.gather_time" type="time" @input="touched.gather = true" /></label>
          <label>신청 마감 <span class="hint">기본: 해당 월 1일</span>
            <input v-model="form.signup_deadline" type="date" @input="touched.deadline = true" /></label>
          <label>팀 수<input v-model.number="form.teams" type="number" min="1" /></label>
          <label>정원 <span class="hint">팀 × 4</span><input v-model.number="form.capacity" type="number" min="1" /></label>
        </div>
        <label>제목<input v-model="form.title" placeholder="예: 12월 필드 정기라운드" @input="touched.title = true" /></label>
        <div class="grid two">
          <label>구장<input v-model="form.venue" placeholder="예: ○○CC" /></label>
          <label>구장 주소<input v-model="form.venue_address" placeholder="지도 검색에 쓰여요" /></label>
        </div>
        <label>공지 <span class="hint">저녁 장소, 준비물 등</span>
          <textarea v-model="form.notice" rows="3" placeholder="예: 저녁 – 라운드 후 클럽하우스 식당" /></label>
        <p class="dim small">로컬룰 8개, 집결·지각·캐디피 안내는 공지에 자동으로 붙어요.</p>
        <p v-if="formErr" class="error">{{ formErr }}</p>
        <p v-if="formMsg" class="ok">{{ formMsg }}</p>
        <div class="btns"><button class="btn" @click="save">{{ editingId ? '수정 저장' : '라운드 만들기' }}</button></div>
      </section>

      <!-- 라운드 목록 -->
      <section class="card">
        <h2>라운드</h2>
        <p v-if="!field.rounds.length" class="dim">만든 라운드가 없어요.</p>
        <div v-for="r in [...field.upcoming, ...field.past]" :key="r.id" class="round" :class="{ sel: editingId === r.id }">
          <div class="round-head">
            <div>
              <b>{{ r.title }}</b> <span class="tag" :class="r.status">{{ STATUS_LABEL[r.status] || r.status }}</span>
              <div class="dim small">{{ r.meet_date.replaceAll('-', '.') }} · 티업 {{ r.meet_time?.slice(0, 5) }}<template v-if="r.venue"> · {{ r.venue }}</template>
                · 신청 {{ field.activeCount(r.id) }}/{{ r.capacity }}<template v-if="field.waitlistOf(r.id).length"> · 대기 {{ field.waitlistOf(r.id).length }}</template>
              </div>
            </div>
          </div>
          <div class="round-btns">
            <button class="btn-ghost sm" @click="openId = openId === r.id ? null : r.id">{{ openId === r.id ? '참석자 접기' : '참석자·노쇼' }}</button>
            <button class="btn-ghost sm" @click="edit(r)">수정</button>
            <button v-if="r.status === 'open'" class="btn-ghost sm" @click="setStatus(r, 'closed')">신청 마감</button>
            <button v-if="r.status === 'closed'" class="btn-ghost sm" @click="setStatus(r, 'open')">신청 재개</button>
            <button v-if="r.status !== 'done' && r.status !== 'canceled'" class="btn-ghost sm" @click="setStatus(r, 'done')">완료</button>
            <button v-if="r.status !== 'canceled' && r.status !== 'done'" class="btn-ghost sm" @click="setStatus(r, 'canceled')">라운드 취소</button>
            <button class="btn-ghost sm danger" @click="remove(r)">삭제</button>
          </div>

          <div v-if="openId === r.id" class="people">
            <p class="dim small">라운드 후 노쇼·지각을 체크하세요. 지각 벌금은 4단계(회계)에서 필드 장부에 자동 등록돼요.
              <RuleLink anchor="rule-2-3">세칙 2-3</RuleLink></p>
            <table>
              <thead><tr><th>#</th><th>이름</th><th>노쇼</th><th>지각</th></tr></thead>
              <tbody>
                <tr v-for="(a, i) in field.confirmedOf(r.id)" :key="a.id" :class="{ bad: a.status === 'no_show' }">
                  <td>{{ i + 1 }}</td>
                  <td>{{ nameOf(a.member_id) }}</td>
                  <td><input type="checkbox" :checked="a.status === 'no_show'" @change="toggleNoShow(a)" :aria-label="`${nameOf(a.member_id)} 노쇼`" /></td>
                  <td><input type="checkbox" :checked="a.late" @change="toggleLate(a)" :aria-label="`${nameOf(a.member_id)} 지각`" /></td>
                </tr>
                <tr v-if="!field.confirmedOf(r.id).length"><td colspan="4" class="dim">신청자가 없어요.</td></tr>
              </tbody>
            </table>
            <template v-if="field.waitlistOf(r.id).length">
              <h3>대기자</h3>
              <p class="dim small">{{ field.waitlistOf(r.id).map((a, i) => `${i + 1}. ${nameOf(a.member_id)}`).join('  ') }}</p>
            </template>
            <template v-if="canceledOf(r.id).length">
              <h3>취소</h3>
              <div v-for="a in canceledOf(r.id)" :key="a.id" class="cancel-row">
                <span>{{ nameOf(a.member_id) }}</span>
                <span class="tier" :class="a.cancel_tier">{{ TIER_LABEL[a.cancel_tier] || '-' }}</span>
              </div>
            </template>
          </div>
        </div>
      </section>

      <!-- 연간 노쇼 -->
      <section class="card">
        <h2>{{ year }}년 노쇼 기록 <RuleLink anchor="art-9">제9조</RuleLink></h2>
        <p class="dim small">노쇼 처리 + 1일 전~당일 취소를 합친 횟수예요. {{ noShowLimit }}회 이상이면 제명 검토 대상이에요.</p>
        <p v-if="!noShowRows.length" class="dim">기록이 없어요.</p>
        <div v-for="row in noShowRows" :key="row.id" class="cancel-row">
          <span>{{ row.name }}</span>
          <span class="tier" :class="row.n >= noShowLimit ? 'late' : 'mid'">{{ row.n }}회<template v-if="row.n >= noShowLimit"> · 제명 검토</template></span>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.page { max-width: 760px; margin: 0 auto; padding: 1.75rem 1.25rem 3rem; display: flex; flex-direction: column; gap: 1rem; }
h1 { font-size: 1.6rem; color: #eaf2e6; margin: 0; }
h2 { font-size: 1.05rem; color: #eaf2e6; margin: 0; display: flex; align-items: center; gap: 0.5rem; }
h3 { font-size: 0.88rem; color: #eaf2e6; margin: 0.8rem 0 0.3rem; }
.card { background: #16271a; border: 1px solid #2c4a33; border-radius: 12px; padding: 1.1rem 1.25rem; display: flex; flex-direction: column; gap: 0.6rem; }
.dim { color: #9db39e; font-size: 0.88rem; margin: 0; }
.small { font-size: 0.8rem; }
.link { color: #6fbf6f; }
.row-between { display: flex; justify-content: space-between; align-items: center; }
.grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.6rem; }
.grid.two { grid-template-columns: 1fr 1fr; }
label { display: flex; flex-direction: column; gap: 0.3rem; color: #9db39e; font-size: 0.82rem; }
.hint { color: #6b8a6c; font-size: 0.72rem; }
input, textarea { padding: 0.55rem 0.7rem; border-radius: 8px; border: 1px solid #2c4a33; background: #0f1b12; color: #eaf2e6; font: inherit; font-size: 0.9rem; min-width: 0; }
input[type=checkbox] { width: 1.1rem; height: 1.1rem; accent-color: #4e9a51; }
textarea { resize: vertical; }
.btns { display: flex; justify-content: flex-end; }
.btn { background: #4e9a51; color: #fff; border: 0; border-radius: 8px; padding: 0.6rem 1.2rem; font: inherit; font-weight: 700; font-size: 0.9rem; cursor: pointer; }
.btn-ghost { background: transparent; border: 1px solid #2c4a33; color: #9db39e; border-radius: 8px; padding: 0.45rem 0.8rem; font: inherit; font-size: 0.85rem; cursor: pointer; }
.btn-ghost.sm { padding: 0.3rem 0.6rem; font-size: 0.8rem; }
.btn-ghost:hover { border-color: #4e9a51; color: #eaf2e6; }
.btn-ghost.danger:hover { border-color: #e8543e; color: #e8543e; }
.error { color: #e8543e; font-size: 0.85rem; margin: 0; }
.ok { color: #6fbf6f; font-size: 0.85rem; margin: 0; }

.round { border-top: 1px solid #2c4a33; padding-top: 0.7rem; }
.round.sel { background: #1d3324; border-radius: 8px; padding: 0.7rem; margin: 0 -0.7rem; }
.round b { color: #eaf2e6; }
.round-btns { display: flex; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.5rem; }
.tag { font-size: 0.7rem; font-weight: 700; border-radius: 4px; padding: 0.05rem 0.4rem; margin-left: 0.2rem; }
.tag.open { background: #4e9a51; color: #fff; }
.tag.closed { background: #2a2612; color: #e8c547; }
.tag.done { background: #2c4a33; color: #9db39e; }
.tag.canceled { background: #3a1f1a; color: #f0907f; }

.people { margin-top: 0.7rem; background: #0f1b12; border-radius: 8px; padding: 0.75rem; }
table { width: 100%; border-collapse: collapse; font-size: 0.86rem; margin-top: 0.5rem; }
th, td { text-align: left; padding: 0.35rem 0.3rem; border-bottom: 1px solid #1d3324; color: #d6e3d3; }
th { color: #9db39e; font-weight: 600; }
tr.bad td { color: #f0907f; }
.cancel-row { display: flex; justify-content: space-between; font-size: 0.86rem; color: #d6e3d3; padding: 0.3rem 0; border-bottom: 1px solid #1d3324; }
.tier { font-size: 0.78rem; font-weight: 600; }
.tier.free { color: #6fbf6f; }
.tier.mid { color: #e8c547; }
.tier.late { color: #f0907f; }

@media (max-width: 560px) {
  .grid, .grid.two { grid-template-columns: 1fr 1fr; }
}
</style>
