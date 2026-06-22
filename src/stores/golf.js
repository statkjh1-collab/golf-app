import { ref, computed } from 'vue'
import { defineStore } from 'pinia'

function load(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}
function save(key, val) { localStorage.setItem(key, JSON.stringify(val)) }

export const useGolfStore = defineStore('golf', () => {
  const members = ref(load('golf_members', []))
  const meetings = ref(load('golf_meetings', []))
  const attendances = ref(load('golf_attendances', []))
  const scores = ref(load('golf_scores', []))
  let _nextId = load('golf_nextId', 1)
  function nextId() { const id = _nextId++; save('golf_nextId', _nextId); return id }

  function persist() {
    save('golf_members', members.value)
    save('golf_meetings', meetings.value)
    save('golf_attendances', attendances.value)
    save('golf_scores', scores.value)
  }

  function addMember(name, handicap) {
    members.value.push({ id: nextId(), name, handicap: Number(handicap) || 0, active: true })
    persist()
  }
  function updateMember(id, name, handicap) {
    const m = members.value.find(m => m.id === id)
    if (m) { m.name = name; m.handicap = Number(handicap) || 0; persist() }
  }
  function deleteMember(id) {
    members.value = members.value.filter(m => m.id !== id); persist()
  }

  function addMeeting(title, date, time) {
    meetings.value.push({ id: nextId(), title, meet_date: date, meet_time: time, capacity: 10, status: 'open', total_fee: null })
    persist()
  }
  function deleteMeeting(id) {
    meetings.value = meetings.value.filter(m => m.id !== id)
    attendances.value = attendances.value.filter(a => a.meeting_id !== id)
    scores.value = scores.value.filter(s => s.meeting_id !== id)
    persist()
  }

  function toggleAttend(meeting_id, member_id) {
    const idx = attendances.value.findIndex(a => a.meeting_id === meeting_id && a.member_id === member_id)
    if (idx >= 0) { attendances.value.splice(idx, 1); persist(); return true }
    const mt = meetings.value.find(m => m.id === meeting_id)
    const cnt = attendances.value.filter(a => a.meeting_id === meeting_id).length
    if (mt && cnt >= mt.capacity) return false
    attendances.value.push({ id: nextId(), meeting_id, member_id, team: null })
    persist(); return true
  }
  function isAttending(meeting_id, member_id) {
    return attendances.value.some(a => a.meeting_id === meeting_id && a.member_id === member_id)
  }
  function attendCount(meeting_id) {
    return attendances.value.filter(a => a.meeting_id === meeting_id).length
  }

  function assignTeams(meeting_id) {
    const atts = attendances.value.filter(a => a.meeting_id === meeting_id)
    const shuffled = [...atts].sort(() => Math.random() - 0.5)
    shuffled.forEach((a, i) => { a.team = i < Math.ceil(shuffled.length / 2) ? 'A' : 'B' })
    persist()
  }

  function saveScores(meeting_id, entries, total_fee) {
    const withNet = entries
      .map(e => ({ ...e, net: e.gross + (e.mulligan ? 1 : 0) - (e.handicap || 0) }))
      .sort((a, b) => a.net - b.net)
    const n = withNet.length
    const ratios = n <= 0 ? [] : n === 1 ? [1] : (() => {
      const raw = withNet.map((_, i) => 5 + 10 * (i / (n - 1)))
      const sum = raw.reduce((a, b) => a + b, 0)
      return raw.map(r => r / sum)
    })()
    scores.value = scores.value.filter(s => s.meeting_id !== meeting_id)
    withNet.forEach((e, i) => {
      const ratio = ratios[i] || 0
      const fee_amount = total_fee ? Math.round(total_fee * ratio / 100) * 100 : null
      scores.value.push({ id: nextId(), meeting_id, member_id: e.member_id, gross: e.gross, mulligan: e.mulligan, net: e.net, rank: i + 1, ratio, fee_amount })
    })
    const mt = meetings.value.find(m => m.id === meeting_id)
    if (mt) { mt.total_fee = total_fee; mt.status = 'done' }

    // 참가 회원 핸디 자동 재계산 (전체 경기 평균 gross - 72, 최소 0)
    const participantIds = [...new Set(entries.map(e => e.member_id))]
    participantIds.forEach(memberId => {
      const allGross = scores.value.filter(s => s.member_id === memberId).map(s => s.gross)
      if (allGross.length === 0) return
      const avg = allGross.reduce((a, b) => a + b, 0) / allGross.length
      const newHc = Math.max(0, Math.round(avg - 72))
      const m = members.value.find(m => m.id === memberId)
      if (m) m.handicap = newHc
    })

    persist()
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

  return {
    members, meetings, attendances, scores,
    addMember, updateMember, deleteMember,
    addMeeting, deleteMeeting,
    toggleAttend, isAttending, attendCount,
    assignTeams, saveScores,
    cumulativeRanking, upcomingMeetings, doneMeetings,
  }
})
