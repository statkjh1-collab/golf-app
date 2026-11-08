<script setup>
import { ref, computed, watch } from 'vue'
import { useGolfStore } from '@/stores/golf'
import { useSettingsStore } from '@/stores/settings'
import { useFieldStore, localToday, daysBetween } from '@/stores/field'
import { shareMessage } from '@/lib/kakao'
import RuleLink from '@/components/rules/RuleLink.vue'

const golf = useGolfStore()
const settings = useSettingsStore()
const field = useFieldStore()

// 본인 선택은 이 기기에 기억해 둔다
const ME_KEY = 'agit:me'
const me = ref(readMe())
function readMe() {
  try { return localStorage.getItem(ME_KEY) || '' } catch { return '' }
}
watch(me, v => { try { v ? localStorage.setItem(ME_KEY, v) : localStorage.removeItem(ME_KEY) } catch { /* 무시 */ } })

const sortedMembers = computed(() =>
  [...golf.members.filter(m => m.active)].sort((a, b) => a.name.localeCompare(b.name, 'ko'))
)
const nameOf = id => golf.members.find(m => m.id === id)?.name || '?'

const openId = ref(null)
const tab = ref('notice')
const msg = ref({})
const busy = ref(null)
const showPast = ref(false)

function toggleDetail(id) {
  openId.value = openId.value === id ? null : id
  tab.value = 'notice'
}

const WEEK = ['일', '월', '화', '수', '목', '금', '토']
function fmtDate(ymd) {
  const d = new Date(`${ymd}T00:00:00`)
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEK[d.getDay()]})`
}
const hm = t => (t ? t.slice(0, 5) : '-')

function deadlineText(r) {
  if (!r.signup_deadline) return null
  const left = daysBetween(localToday(), r.signup_deadline)
  const d = new Date(`${r.signup_deadline}T00:00:00`)
  const day = `${d.getMonth() + 1}/${d.getDate()}`
  if (left < 0) return { text: `신청 마감됨 (${day})`, closed: true }
  return { text: `신청 마감 ${day} (${left === 0 ? '오늘' : `D-${left}`})`, closed: false }
}

function statusLabel(r) {
  const a = field.mine(r.id, me.value)
  if (!a) return null
  if (a.status === 'waitlist') return { text: `대기 ${field.waitlistRank(r.id, me.value)}번`, cls: 'wait' }
  if (a.status === 'canceled') return { text: '취소함', cls: 'off' }
  if (a.status === 'no_show') return { text: '노쇼', cls: 'bad' }
  return { text: '신청 완료', cls: 'ok' }
}

function isActive(r) {
  const a = field.mine(r.id, me.value)
  return !!a && ['applied', 'confirmed', 'waitlist'].includes(a.status)
}

async function apply(r) {
  if (!me.value) { msg.value = { [r.id]: '먼저 본인 이름을 선택하세요.' }; return }
  busy.value = r.id
  const res = await field.apply(r.id, me.value)
  busy.value = null
  if (res.error) msg.value = { [r.id]: res.error }
  else msg.value = { [r.id]: res.status === 'waitlist' ? `정원이 차서 대기 ${field.waitlistRank(r.id, me.value)}번으로 등록했어요.` : '신청했어요.' }
}

// ── 취소 확인 ──
const cancelling = ref(null)
const TIER_TEXT = {
  free: '위약 없이 취소돼요.',
  mid: '대체 인원을 못 구하면 구장 위약금을 본인이 부담해요.',
  late: '구장 위약금을 본인이 부담하고, 노쇼 1회로 기록돼요.',
}
const cancelTier = computed(() => cancelling.value && field.cancelTierNow(cancelling.value, field.mine(cancelling.value.id, me.value)))

async function confirmCancel() {
  const r = cancelling.value
  busy.value = r.id
  const res = await field.cancel(r.id, me.value)
  busy.value = null
  cancelling.value = null
  if (res.error) msg.value = { [r.id]: res.error }
  else msg.value = { [r.id]: res.tier === 'free' ? '취소했어요.' : `취소했어요. ${TIER_TEXT[res.tier]}` }
}

const localRules = computed(() => {
  const v = settings.get('local_rules')
  return Array.isArray(v) ? v : []
})

async function share(r) {
  const lines = [
    `⛳ [아지트 필드] ${r.title}`,
    `📅 ${fmtDate(r.meet_date)}`,
    r.venue ? `📍 ${r.venue}${r.venue_address ? ` (${r.venue_address})` : ''}` : null,
    `🏌️ 첫 티업 ${hm(r.meet_time)} · 집결 ${hm(r.gather_time)} (환복 후 스타트라인)`,
    r.signup_deadline ? `📝 신청 마감 ${r.signup_deadline.slice(5).replace('-', '/')}` : null,
    `👥 신청 ${field.activeCount(r.id)}/${r.capacity}명`,
    r.notice ? `\n${r.notice}` : null,
    `\n신청 → agit-golf-app.vercel.app/field/schedule`,
  ].filter(Boolean)
  try {
    const how = await shareMessage(lines.join('\n'))
    msg.value = { [r.id]: how === 'copied' ? '공지 문구를 복사했어요.' : '' }
  } catch { /* 공유 취소 */ }
}
</script>

<template>
  <main class="page">
    <h1>필드 일정 · 참석</h1>
    <div class="rule-links">
      <RuleLink anchor="rule-2-1">세칙 2-1 신청</RuleLink>
      <RuleLink anchor="rule-2-2">세칙 2-2 취소</RuleLink>
    </div>

    <div class="card">
      <h2>본인 선택</h2>
      <p class="dim">참석 신청을 하려면 본인 이름을 골라주세요. 이 기기에 기억돼요.</p>
      <select v-model="me" aria-label="본인 선택">
        <option value="">이름 선택…</option>
        <option v-for="m in sortedMembers" :key="m.id" :value="String(m.id)">{{ m.name }}</option>
      </select>
    </div>

    <p v-if="!field.upcoming.length" class="empty">예정된 필드 라운드가 없어요.</p>

    <article v-for="r in field.upcoming" :key="r.id" class="round">
      <div class="round-top">
        <div>
          <div class="round-title">{{ r.title }}</div>
          <div class="meta">{{ fmtDate(r.meet_date) }}<template v-if="r.venue"> · {{ r.venue }}</template></div>
          <div class="meta">첫 티업 <b>{{ hm(r.meet_time) }}</b> · 집결 <b>{{ hm(r.gather_time) }}</b></div>
        </div>
        <div class="badges">
          <span class="badge" :class="{ full: field.activeCount(r.id) >= r.capacity }">{{ field.activeCount(r.id) }}/{{ r.capacity }}명</span>
          <span v-if="field.waitlistOf(r.id).length" class="badge wait">대기 {{ field.waitlistOf(r.id).length }}</span>
        </div>
      </div>

      <div class="status-row">
        <span v-if="deadlineText(r)" class="deadline" :class="{ closed: deadlineText(r).closed }">{{ deadlineText(r).text }}</span>
        <span v-if="r.status === 'closed'" class="deadline closed">신청 마감</span>
        <span v-if="statusLabel(r)" class="pill" :class="statusLabel(r).cls">{{ statusLabel(r).text }}</span>
      </div>

      <div class="actions">
        <button v-if="isActive(r)" class="btn-ghost" :disabled="busy === r.id" @click="cancelling = r">신청 취소</button>
        <button v-else class="btn" :disabled="!field.canApply(r) || busy === r.id" @click="apply(r)">
          {{ !field.canApply(r) ? '신청 마감' : field.activeCount(r.id) >= r.capacity ? '대기 신청' : '참석 신청' }}
        </button>
        <button class="btn-ghost" @click="toggleDetail(r.id)" :aria-expanded="openId === r.id">{{ openId === r.id ? '접기' : '공지·신청자' }}</button>
      </div>
      <p v-if="msg[r.id]" class="msg">{{ msg[r.id] }}</p>

      <div v-if="openId === r.id" class="detail">
        <div class="tabs" role="tablist">
          <button role="tab" :aria-selected="tab === 'notice'" :class="{ on: tab === 'notice' }" @click="tab = 'notice'">공지</button>
          <button role="tab" :aria-selected="tab === 'people'" :class="{ on: tab === 'people' }" @click="tab = 'people'">신청자 {{ field.activeCount(r.id) }}</button>
        </div>

        <div v-if="tab === 'notice'" class="notice">
          <dl>
            <dt>구장</dt>
            <dd>{{ r.venue || '-' }}
              <a v-if="r.venue_address" :href="`https://map.naver.com/p/search/${encodeURIComponent(r.venue_address)}`" target="_blank" rel="noopener" class="map">{{ r.venue_address }} ↗</a>
            </dd>
            <dt>첫 티업</dt><dd>{{ hm(r.meet_time) }}</dd>
            <dt>집결</dt><dd>{{ hm(r.gather_time) }} · 환복 후 스타트라인 (단체 촬영) <RuleLink anchor="rule-2-3">세칙 2-3</RuleLink></dd>
            <dt>지각</dt><dd>티업을 지연시키면 벌금 {{ Number(settings.get('late_fine')).toLocaleString() }}원</dd>
            <dt>캐디피</dt><dd>현금 준비, 라운드 후 조장이 각출해 캐디에게 결제 <RuleLink anchor="rule-2-5">세칙 2-5</RuleLink></dd>
          </dl>
          <div v-if="r.notice" class="notice-text">{{ r.notice }}</div>
          <h3>로컬룰 <RuleLink anchor="rule-3">세칙 3</RuleLink></h3>
          <ol class="local-rules">
            <li v-for="(lr, i) in localRules" :key="i">{{ lr }}</li>
          </ol>
          <p class="dim small">위에 없는 사항은 해당 구장 룰을 따릅니다.</p>
          <button class="btn-ghost" @click="share(r)">📣 공지 공유하기</button>
        </div>

        <div v-else class="people">
          <p v-if="!field.confirmedOf(r.id).length" class="dim">아직 신청자가 없어요.</p>
          <ol class="names">
            <li v-for="a in field.confirmedOf(r.id)" :key="a.id" :class="{ me: String(a.member_id) === me }">{{ nameOf(a.member_id) }}</li>
          </ol>
          <template v-if="field.waitlistOf(r.id).length">
            <h3>대기자</h3>
            <ol class="names wait">
              <li v-for="a in field.waitlistOf(r.id)" :key="a.id" :class="{ me: String(a.member_id) === me }">{{ nameOf(a.member_id) }}</li>
            </ol>
            <p class="dim small">신청자가 취소하면 대기 1번부터 자동으로 올라가요.</p>
          </template>
        </div>
      </div>
    </article>

    <section v-if="field.past.length" class="past">
      <button class="btn-ghost" @click="showPast = !showPast">{{ showPast ? '지난 라운드 접기' : `지난 라운드 ${field.past.length}개 보기` }}</button>
      <div v-if="showPast">
        <div v-for="r in field.past" :key="r.id" class="past-row">
          <span>{{ r.meet_date.replaceAll('-', '.') }} · {{ r.title }}</span>
          <span class="dim">{{ r.status === 'canceled' ? '취소됨' : `${field.confirmedOf(r.id).length}명` }}</span>
        </div>
      </div>
    </section>

    <!-- 취소 확인 -->
    <div v-if="cancelling" class="overlay" @click.self="cancelling = null">
      <div class="dialog" role="dialog" aria-modal="true" aria-labelledby="cancel-title">
        <h2 id="cancel-title">신청을 취소할까요?</h2>
        <p class="dim">{{ cancelling.title }} · {{ fmtDate(cancelling.meet_date) }}</p>
        <p class="tier" :class="cancelTier">{{ TIER_TEXT[cancelTier] }}</p>
        <p class="dim small">
          라운드 {{ settings.get('cancel_free_days') }}일 전까지는 위약이 없어요.
          <RuleLink anchor="rule-2-2">세칙 2-2</RuleLink>
        </p>
        <div class="dialog-btns">
          <button class="btn-ghost" @click="cancelling = null">돌아가기</button>
          <button class="btn danger" :disabled="busy" @click="confirmCancel">취소하기</button>
        </div>
      </div>
    </div>
  </main>
</template>

<style scoped>
.page { max-width: 760px; margin: 0 auto; padding: 1.75rem 1.25rem 3rem; }
h1 { font-size: 1.6rem; color: #eaf2e6; margin: 0 0 0.5rem; }
h2 { font-size: 1rem; color: #eaf2e6; margin: 0 0 0.4rem; }
h3 { font-size: 0.92rem; color: #eaf2e6; margin: 1rem 0 0.4rem; display: flex; align-items: center; gap: 0.4rem; }
.rule-links { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 1.25rem; }
.dim { color: #9db39e; font-size: 0.88rem; margin: 0 0 0.6rem; }
.small { font-size: 0.8rem; }
.empty { color: #9db39e; font-size: 0.9rem; }
.card { background: #16271a; border: 1px solid #2c4a33; border-radius: 12px; padding: 1.1rem 1.25rem; margin-bottom: 1.25rem; }
select { width: 100%; background: #0f1b12; border: 1px solid #2c4a33; border-radius: 8px; padding: 0.6rem 0.75rem; color: #eaf2e6; font: inherit; font-size: 0.95rem; }

.round { background: #16271a; border: 1px solid #2c4a33; border-radius: 12px; padding: 1.15rem 1.25rem; margin-bottom: 1rem; }
.round-top { display: flex; justify-content: space-between; gap: 0.75rem; align-items: flex-start; }
.round-title { font-weight: 700; color: #eaf2e6; font-size: 1.02rem; }
.meta { color: #9db39e; font-size: 0.86rem; margin-top: 0.2rem; }
.meta b { color: #eaf2e6; font-weight: 600; }
.badges { display: flex; flex-direction: column; gap: 0.3rem; align-items: flex-end; }
.badge { background: #2c4a33; color: #eaf2e6; font-size: 0.8rem; padding: 0.22rem 0.6rem; border-radius: 20px; font-weight: 600; white-space: nowrap; }
.badge.full { background: #6b3a2e; }
.badge.wait { background: #2a2612; color: #e8c547; }

.status-row { display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; margin: 0.75rem 0; }
.deadline { font-size: 0.8rem; color: #e8c547; }
.deadline.closed { color: #9db39e; }
.pill { font-size: 0.75rem; font-weight: 700; padding: 0.12rem 0.5rem; border-radius: 999px; }
.pill.ok { background: #4e9a51; color: #fff; }
.pill.wait { background: #2a2612; color: #e8c547; border: 1px solid #6b5d24; }
.pill.off { background: #2c4a33; color: #9db39e; }
.pill.bad { background: #6b3a2e; color: #fff; }

.actions { display: flex; gap: 0.5rem; }
.actions .btn { flex: 1; }
.btn { background: #4e9a51; color: #fff; border: 0; border-radius: 8px; padding: 0.65rem 1rem; font: inherit; font-weight: 700; font-size: 0.92rem; cursor: pointer; }
.btn:disabled { background: #2c4a33; color: #9db39e; cursor: not-allowed; }
.btn.danger { background: #b8432f; }
.btn-ghost { background: transparent; border: 1px solid #2c4a33; color: #9db39e; border-radius: 8px; padding: 0.6rem 0.9rem; font: inherit; font-size: 0.88rem; cursor: pointer; }
.btn-ghost:hover:not(:disabled) { border-color: #4e9a51; color: #eaf2e6; }
.actions .btn-ghost:first-child { flex: 1; }
.msg { font-size: 0.85rem; color: #6fbf6f; margin: 0.5rem 0 0; }

.detail { border-top: 1px solid #2c4a33; margin-top: 0.9rem; padding-top: 0.8rem; }
.tabs { display: flex; gap: 0.3rem; margin-bottom: 0.75rem; }
.tabs button { background: transparent; border: 1px solid #2c4a33; color: #9db39e; border-radius: 999px; padding: 0.3rem 0.85rem; font: inherit; font-size: 0.85rem; cursor: pointer; }
.tabs button.on { background: #2c4a33; color: #eaf2e6; border-color: #3d6642; }

dl { display: grid; grid-template-columns: 4.2rem 1fr; gap: 0.45rem 0.6rem; margin: 0; font-size: 0.88rem; }
dt { color: #9db39e; }
dd { margin: 0; color: #eaf2e6; line-height: 1.55; }
.map { display: block; color: #6fbf6f; font-size: 0.82rem; text-decoration: none; }
.notice-text { white-space: pre-wrap; background: #1d3324; border-radius: 8px; padding: 0.7rem 0.85rem; margin-top: 0.8rem; font-size: 0.88rem; color: #eaf2e6; line-height: 1.6; }
.local-rules { margin: 0 0 0.4rem; padding-left: 1.25rem; font-size: 0.86rem; color: #d6e3d3; line-height: 1.7; }

.names { margin: 0; padding-left: 1.5rem; columns: 2; font-size: 0.9rem; color: #eaf2e6; line-height: 1.8; }
.names.wait { color: #e8c547; columns: 1; }
.names li.me { font-weight: 700; color: #6fbf6f; }

.past { margin-top: 1.5rem; }
.past-row { display: flex; justify-content: space-between; gap: 0.5rem; border-bottom: 1px solid #2c4a33; padding: 0.55rem 0; font-size: 0.86rem; color: #d6e3d3; }
.past-row .dim { margin: 0; }

.overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.6); display: flex; align-items: center; justify-content: center; padding: 1rem; z-index: 50; }
.dialog { background: #16271a; border: 1px solid #3d6642; border-radius: 14px; padding: 1.25rem; width: 100%; max-width: 400px; }
.tier { font-size: 0.92rem; font-weight: 600; border-radius: 8px; padding: 0.65rem 0.8rem; margin: 0.6rem 0; }
.tier.free { background: #1d3324; color: #6fbf6f; }
.tier.mid { background: #2a2612; color: #e8c547; }
.tier.late { background: #3a1f1a; color: #f0907f; }
.dialog-btns { display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.9rem; }

@media (max-width: 480px) {
  .page { padding: 1.25rem 1rem 3rem; }
  .names { columns: 1; }
}
</style>
