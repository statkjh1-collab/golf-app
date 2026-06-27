const KAKAO_JS_KEY = '6e5246d4527915879b4500bc667764d3'

function init() {
  if (window.Kakao && !window.Kakao.isInitialized()) {
    window.Kakao.init(KAKAO_JS_KEY)
  }
}

export function sendKakaoMemo(text) {
  init()
  return new Promise((resolve, reject) => {
    window.Kakao.Auth.login({
      scope: 'talk_message',
      success() {
        window.Kakao.API.request({
          url: '/v2/api/talk/memo/default/send',
          data: {
            template_object: {
              object_type: 'text',
              text,
              link: {
                web_url: 'https://agit-golf-app.vercel.app/ranking',
                mobile_web_url: 'https://agit-golf-app.vercel.app/ranking',
              },
            },
          },
          success: resolve,
          fail: reject,
        })
      },
      fail: reject,
    })
  })
}
