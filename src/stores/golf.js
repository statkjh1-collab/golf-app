import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { supabase } from '@/lib/supabase'

export const useGolfStore = defineStore('golf', () => {
  const members = ref([])
  const meetings = ref([])
  const attendances = ref([])
  const scores = ref([])
  const accessLogs = ref([])
  const loading = ref(false)

  async function fetchAccessLogs() {
    const { data } = await supabase.from('access_logs').select('*').order('created_at', { ascending: false }).limit(200)
    accessLogs.value = data || []
  }

  async function logAccess(member_id) {
    const member = members.value.find(m => m.id === member_id)
    if (!member) return
    const { data } = await supabase.from('access_logs').insert({ member_id, name: member.name }).select().single()
    if (data) accessLogs.value.unshift(data)
  }

  async function clearAccessLogs() {
    await supabase.from('access_logs').delete().neq('id', 0)
    accessLogs.value = []
  }

  async function fetchAll() {
    loading.value = true
    const [m, mt, a, s] = await Promise.all([
      supabase.from('members').select('*').order('id'),
      supabase.from('meetings').select('*').order('meet_date'),
      supabase.from('attendances').select('*'),
      supabase.from('scores').select('*'),
    ])
    members.value = m.data || []
    meetings.value = mt.data || []
    attendances.value = a.data || []
    scores.value = s.data || []
    loading.value = false
  }

  // 회원
  async function addMember(name, handicap) {
    const { data } = await supabase.from('members').insert({ name, handicap: Number(handicap) || 0 }).select().single()
    if (data) members.value.push(data)
  }
  async function updateMember(id, name, handicap) {
    const { data } = await supabase.from('members').update({ name, handicap: Number(handicap) || 0 }).eq('id', id).select().single()
    if (data) { const i = members.value.findIndex(m => m.id === id); if (i >= 0) members.value[i] = data }
  }
  async function deleteMember(id) {
    await supabase.from('members').delete().eq('id', id)
    members.value = members.value.filter(m => m.id !== id)
  }

  // 모임
  async function addMeeting(title, date, time) {
    const { data } = await supabase.from('meetings').insert({ title, meet_date: date, meet_time: time, capacity: 10, status: 'open' }).select().single()
    if (data) meetings.value.push(data)
  }
  async function updateMeeting(id, title, date, time) {
    const { data } = await supabase.from('meetings').update({ title, meet_date: date, meet_time: time }).eq('id', id).select().single()
    if (data) { const i = meetings.value.findIndex(m => m.id === id); if (i >= 0) meetings.value[i] = data }
  }
  async function deleteMeeting(id) {
    await supabase.from('meetings').delete().eq('id', id)
    meetings.value = meetings.value.filter(m => m.id !== id)
    attendances.value = attendances.value.filter(a => a.meeting_id !== id)
    scores.value = scores.value.filter(s => s.meeting_id !== id)
  }

  async function generateYearSchedule(year) {
    const toInsert = []
    for (let month = 0; month < 12; month++) {
      for (const [n, time] of [[2, '15:00'], [4, '11:00']]) {
        const firstDay = new Date(year, month, 1)
        const dow = firstDay.getDay()
        const firstSunday = dow === 0 ? 1 : 8 - dow
        const day = firstSunday + (n - 1) * 7
        const date = new Date(year, month, day)
        if (date.getMonth() !== month) continue
        const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
        if (meetings.value.some(m => m.meet_date === dateStr)) continue
        const weekLabel = n === 2 ? '둘째 주' : '넷째 주'
        toInsert.push({ title: `${month + 1}월 ${weekLabel} 정기모임`, meet_date: dateStr, meet_time: time, capacity: 10, status: 'open' })
      }
    }
    if (!toInsert.length) return 0
    const { data } = await supabase.from('meetings').insert(toInsert).select()
    if (data) meetings.value.push(...data)
    return toInsert.length
  }

  // 참석
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

  // 조편성
  async function assignTeams(meeting_id) {
    const atts = attendances.value.filter(a => a.meeting_id === meeting_id)
    const shuffled = [...atts].sort(() => Math.random() - 0.5)
    const updates = shuffled.map((a, i) => ({ ...a, team: i < Math.ceil(shuffled.length / 2) ? 'A' : 'B' }))
    await Promise.all(updates.map(a => supabase.from('attendances').update({ team: a.team }).eq('id', a.id)))
    updates.forEach(upd => {
      const i = attendances.value.findIndex(a => a.id === upd.id)
      if (i >= 0) attendances.value[i] = upd
    })
  }

  // 스코어
  async function saveScores(meeting_id, entries, total_fee) {
    const withNet = entries
      .map(e => ({ ...e, net: e.net_input + (e.mulligan ? 1 : 0) }))
      .sort((a, b) => a.net - b.net)
    const n = withNet.length
    const ratios = n <= 0 ? [] : n === 1 ? [1] : (() => {
      const raw = withNet.map((_, i) => 5 + 10 * (i / (n - 1)))
      const sum = raw.reduce((a, b) => a + b, 0)
      return raw.map(r => r / sum)
    })()

    await supabase.from('scores').delete().eq('meeting_id', meeting_id)
    scores.value = scores.value.filter(s => s.meeting_id !== meeting_id)

    const toInsert = withNet.map((e, i) => ({
      meeting_id,
      member_id: e.member_id,
      gross: 0,
      mulligan: e.mulligan,
      net: e.net,
      rank: i + 1,
      ratio: ratios[i] || 0,
      fee_amount: total_fee ? Math.round(total_fee * (ratios[i] || 0) / 100) * 100 : null,
    }))
    const { data: newScores } = await supabase.from('scores').insert(toInsert).select()
    if (newScores) scores.value.push(...newScores)

    await supabase.from('meetings').update({ status: 'done' }).eq('id', meeting_id)
    const mt = meetings.value.find(m => m.id === meeting_id)
    if (mt) mt.status = 'done'
  }

  async function updateMeetingFee(meeting_id, total_fee, feeRows) {
    // 각 참석자별 fee_amount 업데이트
    await Promise.all(feeRows.map(r =>
      supabase.from('scores').update({ fee_amount: r.fee_amount, ratio: r.ratio }).eq('id', r.id)
    ))
    // meeting에 total_fee 저장
    await supabase.from('meetings').update({ total_fee }).eq('id', meeting_id)
    const mt = meetings.value.find(m => m.id === meeting_id)
    if (mt) mt.total_fee = total_fee
    // 로컬 scores 업데이트
    feeRows.forEach(r => {
      const s = scores.value.find(s => s.id === r.id)
      if (s) { s.fee_amount = r.fee_amount; s.ratio = r.ratio }
    })
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
    const now = new Date()
    const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
    const limit = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate())
    const limitStr = `${limit.getFullYear()}-${String(limit.getMonth()+1).padStart(2,'0')}-${String(limit.getDate()).padStart(2,'0')}`
    return meetings.value
      .filter(m => m.meet_date >= today && m.meet_date <= limitStr && m.status !== 'done')
      .sort((a, b) => a.meet_date.localeCompare(b.meet_date))
  })

  const doneMeetings = computed(() =>
    meetings.value.filter(m => m.status === 'done').sort((a, b) => b.meet_date.localeCompare(a.meet_date))
  )

  return {
    members, meetings, attendances, scores, loading,
    fetchAll,
    accessLogs, logAccess, fetchAccessLogs, clearAccessLogs,
    addMember, updateMember, deleteMember,
    addMeeting, updateMeeting, deleteMeeting, generateYearSchedule,
    toggleAttend, isAttending, attendCount,
    assignTeams, saveScores, updateMeetingFee,
    cumulativeRanking, upcomingMeetings, doneMeetings,
  }
})
