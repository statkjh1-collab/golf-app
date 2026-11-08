import { ref } from 'vue'

// 운영진 비밀번호 확인 (스크린·필드 관리자 공통)
// 로그인 상태는 브라우저 탭을 닫기 전까지 유지한다.
const ADMIN_PW = 'golf1234'
const KEY = 'agit:admin'

function read() {
  try { return sessionStorage.getItem(KEY) === '1' } catch { return false }
}

const authed = ref(read())

export function useAdminAuth() {
  function tryLogin(pw) {
    if (pw !== ADMIN_PW) return false
    authed.value = true
    try { sessionStorage.setItem(KEY, '1') } catch { /* 무시 */ }
    return true
  }
  return { authed, tryLogin }
}
