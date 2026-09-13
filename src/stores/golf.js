import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '@/supabase'

export const useGolfStore = defineStore('golf', () => {
  const members = ref([])
  const meetings = ref([])
  const attendances = ref([])
  const scores = ref([])
  const loading = ref(false)

  async function init() {
    loading.value = true
    const [m, mt, a, s] = await Promise.all([
      supabase.from('members').select('*').order('id'),
      supabase.from('meetings').select('*').order('id'),
      supabase.from('attendances').select('*').order('id'),
      supabase.from('scores').select('*').order('id'),
    ])
    members.value = m.data || []
    meetings.value = mt.data || []
    attendances.value = a.data || []
    scores.value = s.data || []
    loading.value = false
  }

  async function addMember(name, handicap) {
    const { data } = await supabase.from('members').insert({ name, handicap: Number(handicap) || 0, active: true }).select().single()
    if (data) members.value.push(data)
  }

  async function updateMember(id, name, handicap) {
    const { data } = await supabase.from('members').update({ name, handicap: Number(handicap) || 0 }).eq('id', id).select().single()
    if (data) {
      const idx = members.value.findIndex(m => m.id === id)
      if (idx >= 0) members.value[idx] = data
    }
  }

  async function deleteMember(id) {
    await supabase.from('members').delete().eq('id', id)
    members.value = members.value.filter(m => m.id !== id)
  }

  async function addMeeting(title, date, time) {
    const { data } = await supabase.from('meetings').insert({ title, meet_date: date, meet_time: time, capacity: 10, status: 'open', total_fee: null }).select().single()
    if (data) meetings.value.push(data)
  }

  async function updateMeeting(id, title, date, time) {
    const { data } = await supabase.from('meetings').update({ title, meet_date: date, meet_time: time }).eq('id', id).select().single()
    if (data) {
      const idx = meetings.value.findIndex(m => m.id === id)
      if (idx >= 0) meetings.value[idx] = data
    }
  }

  async function updateMeetingFee(meeting_id, total_fee, feeRows) {
    await supabase.from('meetings').update({ total_fee, status: 'done' }).eq('id', meeting_id)
    const mt = meetings.value.find(m => m.id === meeting_id)
    if (mt) { mt.total_fee = total_fee; mt.status = 'done' }
    await Promise.all(feeRows.map(r =>
      supabase.from('scores').update({ fee_amount: r.fee_amount, ratio: r.ratio }).eq('id', r.id)
    ))
    feeRows.forEach(r => {
      const s = scores.value.find(s => s.id === r.id)
      if (s) { s.fee_amount = r.fee_amount; s.ratio = r.ratio }
    })
  }

  async function deleteMeeting(id) {
    await supabase.from('meetings').delete().eq('id', id)
    meetings.value = meetings.value.filter(m => m.id !== id)
    attendances.value = attendances.value.filter(a => a.meeting_id !== id)
    scores.value = scores.value.filter(s => s.meeting_id !== id)
  }

  async function toggleAttend(meeting_id, member_id) {
    const existing = attendances.value.find(a => a.meeting_id === meeting_id && a.member_id === member_id)
    if (existing) {
      await supabase.from('attendances').delete().eq('id', existing.id)
      attendances.value = attendances.value.filter(a => a.id !== existing.id)
      return true
    }
    const mt = meetings.value.find(m => m.id === meeting_id)
    const cnt = attendances.value.filter(a => a.meeting_id === meeting_id).length
    if (mt && cnt >= mt.capacity) return false
    const { data } = await supabase.from('attendances').insert({ meeting_id, member_id, team: null }).select().single()
    if (data) attendances.value.push(data)
    return true
  }

  function isAttending(meeting_id, member_id) {
    return attendances.value.some(a => a.meeting_id === meeting_id && a.member_id === member_id)
  }

  function attendCount(meeting_id) {
    return attendances.value.filter(a => a.meeting_id === meeting_id).length
  }

  async function assignTeams(meeting_id) {
    const atts = attendances.value.filter(a => a.meeting_id === meeting_id)
    const shuffled = [...atts].sort(() => Math.random() - 0.5)
    const updates = shuffled.map((a, i) => ({ ...a, team: i < Math.ceil(shuffled.length / 2) ? 'A' : 'B' }))
    await Promise.all(updates.map(a => supabase.from('attendances').update({ team: a.team }).eq('id', a.id)))
    updates.forEach(u => {
      const idx = attendances.value.findIndex(a => a.id === u.id)
      if (idx >= 0) attendances.value[idx] = { ...attendances.value[idx], team: u.team }
    })
  }

  async function saveScores(meeting_id, entries, total_fee) {
    const withNet = entries
      .map(e => ({ ...e, net: e.net_input != null ? Number(e.net_input) : e.gross + (e.mulligan ? 1 : 0) - (e.handicap || 0) }))
      .sort((a, b) => a.net - b.net)
    const n = withNet.length
    const ratios = n <= 0 ? [] : n === 1 ? [1] : (() => {
      const raw = withNet.map((_, i) => 5 + 10 * (i / (n - 1)))
      const sum = raw.reduce((a, b) => a + b, 0)
      return raw.map(r => r / sum)
    })()

    const { error: delError } = await supabase.from('scores').delete().eq('meeting_id', meeting_id)
    if (delError) { console.error('scores delete error:', delError); return delError }

    // 삭제가 실제로 반영됐는지 확인 — 남아있으면 INSERT 시 중복이 생김
    const { data: leftover } = await supabase.from('scores').select('id').eq('meeting_id', meeting_id)
    if (leftover?.length) return { message: `기존 스코어 ${leftover.length}건이 삭제되지 않았어요. 새로고침 후 다시 시도해주세요.` }

    scores.value = scores.value.filter(s => s.meeting_id !== meeting_id)

    const newScores = withNet.map((e, i) => ({
      meeting_id,
      member_id: e.member_id,
      gross: e.gross,
      mulligan: e.mulligan,
      net: e.net,
      rank: i + 1,
      ratio: ratios[i] || 0,
      fee_amount: total_fee ? Math.round(total_fee * (ratios[i] || 0) / 100) * 100 : null,
    }))

    const { data, error } = await supabase.from('scores').insert(newScores).select()
    if (error) { console.error('scores insert error:', error); return error }
    if (data) scores.value.push(...data)

    await supabase.from('meetings').update({ total_fee, status: 'done' }).eq('id', meeting_id)
    const mt = meetings.value.find(m => m.id === meeting_id)
    if (mt) { mt.total_fee = total_fee; mt.status = 'done' }

    // 핸디 자동 재계산
    const participantIds = [...new Set(entries.map(e => e.member_id))]
    await Promise.all(participantIds.map(async memberId => {
      const allGross = scores.value.filter(s => s.member_id === memberId && s.gross > 0).map(s => s.gross)
      if (!allGross.length) return
      const avg = allGross.reduce((a, b) => a + b, 0) / allGross.length
      const newHc = Math.max(0, Math.round(avg - 72))
      await supabase.from('members').update({ handicap: newHc }).eq('id', memberId)
      const m = members.value.find(m => m.id === memberId)
      if (m) m.handicap = newHc
    }))
  }

  // 회비
  const transactions = ref([])
  const balance = computed(() =>
    transactions.value.reduce((sum, t) => sum + Number(t.income || 0) - Number(t.expense || 0), 0)
  )
  async function fetchTransactions() {
    const { data } = await supabase.from('transactions').select('*').order('date').order('id')
    transactions.value = data || []
  }
  async function addTransaction({ date, description, income, expense, memo }) {
    const { data } = await supabase.from('transactions').insert({ date, description, income, expense, memo }).select().single()
    if (data) {
      // 날짜순 유지
      const idx = transactions.value.findIndex(t => t.date > date)
      if (idx === -1) transactions.value.push(data)
      else transactions.value.splice(idx, 0, data)
    }
  }
  async function deleteTransaction(id) {
    await supabase.from('transactions').delete().eq('id', id)
    transactions.value = transactions.value.filter(t => t.id !== id)
  }
  async function updateTransactionMemo(id, memo) {
    await supabase.from('transactions').update({ memo }).eq('id', id)
    const t = transactions.value.find(t => t.id === id)
    if (t) t.memo = memo
  }

  const cumulativeRanking = computed(() => {
    const map = {}
    scores.value.forEach(s => {
      if (s.rank == null) return
      if (!map[s.member_id]) map[s.member_id] = { games: 0, points: 0, wins: 0 }
      map[s.member_id].games++
      map[s.member_id].points += Math.max(11 - s.rank, 1)
      if (s.rank === 1) map[s.member_id].wins++
    })
    return Object.entries(map)
      .map(([id, v]) => ({ id: Number(id), name: members.value.find(m => m.id === Number(id))?.name || '?', ...v }))
      .sort((a, b) => b.points - a.points)
  })

  const upcomingMeetings = computed(() => {
    const today = new Date().toISOString().slice(0, 10)
    return meetings.value.filter(m => m.meet_date >= today && m.status !== 'done').sort((a, b) => a.meet_date.localeCompare(b.meet_date))
  })

  const doneMeetings = computed(() =>
    meetings.value.filter(m => m.status === 'done').sort((a, b) => b.meet_date.localeCompare(a.meet_date))
  )

  // 접속 로그 (미사용 스텁)
  const accessLogs = ref([])
  function fetchAccessLogs() {}
  function clearAccessLogs() { accessLogs.value = [] }

  // 조 수동 배정
  async function setMemberTeam(attendanceId, team) {
    await supabase.from('attendances').update({ team }).eq('id', attendanceId)
    const a = attendances.value.find(a => a.id === attendanceId)
    if (a) a.team = team
  }

  // 연간 일정 자동 생성
  async function generateYearSchedule(year) {
    const existing = meetings.value.map(m => m.meet_date)
    const toAdd = []
    for (let month = 1; month <= 12; month++) {
      // 둘째 주 일요일
      const d2 = nthWeekday(year, month, 0, 2)
      if (!existing.includes(d2)) toAdd.push({ title: `${month}월 둘째 주 정기모임`, meet_date: d2, meet_time: '15:00:00', capacity: 10, status: 'open', total_fee: null })
      // 넷째 주 일요일
      const d4 = nthWeekday(year, month, 0, 4)
      if (!existing.includes(d4)) toAdd.push({ title: `${month}월 넷째 주 정기모임`, meet_date: d4, meet_time: '11:00:00', capacity: 10, status: 'open', total_fee: null })
    }
    if (!toAdd.length) return 0
    const { data } = await supabase.from('meetings').insert(toAdd).select()
    if (data) meetings.value.push(...data)
    return toAdd.length
  }

  function nthWeekday(year, month, weekday, nth) {
    const d = new Date(year, month - 1, 1)
    let count = 0
    while (d.getMonth() === month - 1) {
      if (d.getDay() === weekday) { count++; if (count === nth) return d.toISOString().slice(0, 10) }
      d.setDate(d.getDate() + 1)
    }
    return null
  }

  return {
    members, meetings, attendances, scores, loading,
    init,
    addMember, updateMember, deleteMember,
    addMeeting, updateMeeting, deleteMeeting, updateMeetingFee,
    accessLogs, fetchAccessLogs, clearAccessLogs,
    setMemberTeam, generateYearSchedule,
    toggleAttend, isAttending, attendCount,
    assignTeams, saveScores,
    transactions, balance, fetchTransactions, addTransaction, deleteTransaction, updateTransactionMemo,
    cumulativeRanking, upcomingMeetings, doneMeetings,
  }
})
