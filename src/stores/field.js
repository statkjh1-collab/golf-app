import { computed } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '@/supabase'
import { useGolfStore } from '@/stores/golf'
import { useSettingsStore } from '@/stores/settings'

// 필드 정기라운드: 일정·참석 (세칙 2-1, 2-2)
// 라운드는 meetings(type='field'), 참석은 attendances 테이블을 같이 쓴다.

export const ACTIVE = ['applied', 'confirmed']

// 브라우저 기준(한국) 오늘 날짜 YYYY-MM-DD
export function localToday() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function daysBetween(fromYmd, toYmd) {
  const a = new Date(`${fromYmd}T00:00:00`)
  const b = new Date(`${toYmd}T00:00:00`)
  return Math.round((b - a) / 86400000)
}

// 신청 마감 기본값: 라운드가 있는 달의 1일
export function defaultDeadline(meetDate) {
  return meetDate ? `${meetDate.slice(0, 7)}-01` : ''
}

// 집결 시간 기본값: 첫 티업 N분 전
export function defaultGather(teeTime, minutesBefore) {
  if (!teeTime) return ''
  const [h, m] = teeTime.split(':').map(Number)
  const total = Math.max(0, h * 60 + m - Number(minutesBefore || 0))
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

export const useFieldStore = defineStore('field', () => {
  const golf = useGolfStore()
  const settings = useSettingsStore()

  const rounds = computed(() =>
    [...golf.fieldMeetings].sort((a, b) => a.meet_date.localeCompare(b.meet_date) || a.meet_time.localeCompare(b.meet_time))
  )
  const upcoming = computed(() => {
    const today = localToday()
    return rounds.value.filter(r => r.meet_date >= today && r.status !== 'done' && r.status !== 'canceled')
  })
  const past = computed(() => {
    const today = localToday()
    return rounds.value.filter(r => r.meet_date < today || r.status === 'done' || r.status === 'canceled').reverse()
  })

  function attendancesOf(meetingId) {
    return golf.fieldAttendances.filter(a => a.meeting_id === meetingId)
  }
  function confirmedOf(meetingId) {
    return attendancesOf(meetingId)
      .filter(a => ACTIVE.includes(a.status) || a.status === 'no_show')
      .sort((a, b) => (a.applied_at || '').localeCompare(b.applied_at || ''))
  }
  function waitlistOf(meetingId) {
    return attendancesOf(meetingId)
      .filter(a => a.status === 'waitlist')
      .sort((a, b) => (a.waitlist_order ?? 0) - (b.waitlist_order ?? 0) || (a.applied_at || '').localeCompare(b.applied_at || ''))
  }
  function activeCount(meetingId) {
    return attendancesOf(meetingId).filter(a => ACTIVE.includes(a.status)).length
  }
  function mine(meetingId, memberId) {
    if (!memberId) return null
    return attendancesOf(meetingId).find(a => a.member_id === Number(memberId)) || null
  }
  function waitlistRank(meetingId, memberId) {
    const i = waitlistOf(meetingId).findIndex(a => a.member_id === Number(memberId))
    return i >= 0 ? i + 1 : null
  }

  function deadlinePassed(r) {
    return !!r.signup_deadline && localToday() > r.signup_deadline
  }
  function canApply(r) {
    return r.status === 'open' && !deadlinePassed(r)
  }

  // 지금 취소하면 어느 구간인지 (세칙 2-2). 실제 판정은 DB 함수가 한다.
  function cancelTierNow(r, attendance) {
    if (attendance?.status === 'waitlist') return 'free'
    const left = daysBetween(localToday(), r.meet_date)
    if (left >= Number(settings.get('cancel_free_days'))) return 'free'
    if (left > Number(settings.get('cancel_late_days'))) return 'mid'
    return 'late'
  }

  async function refreshRound(meetingId) {
    const { data, error } = await supabase.from('attendances').select('*').eq('meeting_id', meetingId).order('id')
    if (error) return error
    golf.fieldAttendances = [...golf.fieldAttendances.filter(a => a.meeting_id !== meetingId), ...(data || [])]
  }

  async function apply(meetingId, memberId) {
    const { data, error } = await supabase.rpc('field_apply', { p_meeting: meetingId, p_member: Number(memberId) })
    await refreshRound(meetingId)
    if (error) return { error: error.message }
    return { status: data?.status }
  }

  async function cancel(meetingId, memberId) {
    const { data, error } = await supabase.rpc('field_cancel', { p_meeting: meetingId, p_member: Number(memberId) })
    await refreshRound(meetingId)
    if (error) return { error: error.message }
    return { tier: data }
  }

  // ── 관리자 ──
  const ROUND_FIELDS = ['title', 'meet_date', 'meet_time', 'venue', 'venue_address', 'capacity', 'signup_deadline', 'gather_time', 'notice']
  const clean = f => Object.fromEntries(ROUND_FIELDS.map(k => [k, f[k] === '' || f[k] === undefined ? null : f[k]]))

  async function createRound(fields) {
    const row = { ...clean(fields), type: 'field', status: 'open', total_fee: null }
    const { data, error } = await supabase.from('meetings').insert(row).select().single()
    if (error) return { error: error.message }
    golf.fieldMeetings.push(data)
    return { data }
  }

  async function updateRound(id, fields) {
    const { data, error } = await supabase.from('meetings').update(clean(fields)).eq('id', id).eq('type', 'field').select().single()
    if (error) return { error: error.message }
    const i = golf.fieldMeetings.findIndex(r => r.id === id)
    if (i >= 0) golf.fieldMeetings[i] = data
    return { data }
  }

  async function setRoundStatus(id, status) {
    const { data, error } = await supabase.from('meetings').update({ status }).eq('id', id).eq('type', 'field').select().single()
    if (error) return error.message
    const i = golf.fieldMeetings.findIndex(r => r.id === id)
    if (i >= 0) golf.fieldMeetings[i] = data
  }

  async function deleteRound(id) {
    const { error } = await supabase.from('meetings').delete().eq('id', id).eq('type', 'field')
    if (error) return error.message
    golf.fieldMeetings = golf.fieldMeetings.filter(r => r.id !== id)
    golf.fieldAttendances = golf.fieldAttendances.filter(a => a.meeting_id !== id)
  }

  async function patchAttendance(id, patch) {
    const { data, error } = await supabase.from('attendances').update(patch).eq('id', id).select().single()
    if (error) return error.message
    const i = golf.fieldAttendances.findIndex(a => a.id === id)
    if (i >= 0) golf.fieldAttendances[i] = data
  }
  const setNoShow = (id, on) => patchAttendance(id, { status: on ? 'no_show' : 'applied' })
  const setLate = (id, on) => patchAttendance(id, { late: on })

  // ── 조편성 (attendances.team 칸에 조 번호 '1', '2', … 저장) ──
  function activeOf(meetingId) {
    return attendancesOf(meetingId).filter(a => ACTIVE.includes(a.status))
  }

  // 조 번호 → 사람 목록. 미배정은 '' 키.
  function groupsOf(meetingId) {
    const map = {}
    activeOf(meetingId)
      .sort((a, b) => (a.applied_at || '').localeCompare(b.applied_at || ''))
      .forEach(a => { const k = a.team || ''; (map[k] ||= []).push(a) })
    const numbers = Object.keys(map).filter(Boolean).map(Number).sort((a, b) => a - b)
    return { groups: numbers.map(n => ({ no: n, people: map[String(n)] })), unassigned: map[''] || [] }
  }

  function hasGroups(meetingId) {
    return activeOf(meetingId).some(a => a.team)
  }

  // 무작위 편성: 4명씩, 조 인원 차이가 1명 넘지 않게 고르게 나눈다
  async function assignGroups(meetingId) {
    const people = [...activeOf(meetingId)]
    for (let i = people.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[people[i], people[j]] = [people[j], people[i]]
    }
    const count = Math.max(1, Math.ceil(people.length / 4))
    const results = await Promise.all(people.map((a, i) => patchAttendance(a.id, { team: String((i % count) + 1) })))
    return results.find(Boolean) // 오류 메시지가 있으면 첫 번째
  }

  const setGroup = (attendanceId, no) => patchAttendance(attendanceId, { team: no ? String(no) : null })

  async function clearGroups(meetingId) {
    const results = await Promise.all(activeOf(meetingId).filter(a => a.team).map(a => patchAttendance(a.id, { team: null })))
    return results.find(Boolean)
  }

  // 회원별 연간 노쇼 횟수: 노쇼 처리 + 1일 전~당일 취소 (세칙 2-2, 제9조)
  function noShowCounts(year = localToday().slice(0, 4)) {
    const ids = new Set(golf.fieldMeetings.filter(r => r.meet_date.startsWith(String(year))).map(r => r.id))
    const counts = {}
    golf.fieldAttendances.forEach(a => {
      if (!ids.has(a.meeting_id)) return
      if (a.status === 'no_show' || (a.status === 'canceled' && a.cancel_tier === 'late')) {
        counts[a.member_id] = (counts[a.member_id] || 0) + 1
      }
    })
    return counts
  }

  return {
    rounds, upcoming, past,
    attendancesOf, confirmedOf, waitlistOf, activeCount, mine, waitlistRank,
    deadlinePassed, canApply, cancelTierNow,
    refreshRound, apply, cancel,
    createRound, updateRound, setRoundStatus, deleteRound, setNoShow, setLate, noShowCounts,
    groupsOf, hasGroups, assignGroups, setGroup, clearGroups,
  }
})
