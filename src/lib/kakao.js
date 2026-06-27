export async function shareMessage(text) {
  // 모바일: 공유 시트 (카카오톡 등 선택 가능)
  if (navigator.share) {
    await navigator.share({ text })
    return 'shared'
  }
  // 데스크탑: 클립보드 복사
  await navigator.clipboard.writeText(text)
  return 'copied'
}
