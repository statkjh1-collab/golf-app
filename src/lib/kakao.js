const KAKAO_JS_KEY = '6e5246d4527915879b4500bc667764d3'
const REDIRECT_URI = 'https://agit-golf-app.vercel.app/admin'

export function kakaoLoginAndSend(message) {
  sessionStorage.setItem('kakao_pending_message', message)
  const url = `https://kauth.kakao.com/oauth/authorize?client_id=${KAKAO_JS_KEY}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=talk_message`
  window.location.href = url
}

export async function checkAndSendKakaoMessage() {
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''))
  const accessToken = hash.get('access_token')
  if (!accessToken) return null

  // URL에서 토큰 제거
  history.replaceState(null, '', '/admin')

  const message = sessionStorage.getItem('kakao_pending_message')
  sessionStorage.removeItem('kakao_pending_message')
  if (!message) return null

  const res = await fetch('https://kapi.kakao.com/v2/api/talk/memo/default/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'template_object=' + encodeURIComponent(JSON.stringify({
      object_type: 'text',
      text: message,
      link: {
        web_url: 'https://agit-golf-app.vercel.app/ranking',
        mobile_web_url: 'https://agit-golf-app.vercel.app/ranking',
      },
    })),
  })

  if (!res.ok) throw await res.json()
  return true
}
