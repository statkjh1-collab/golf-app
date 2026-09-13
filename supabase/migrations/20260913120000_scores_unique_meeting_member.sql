-- 한 모임에 회원당 스코어는 한 건만 존재하도록 보장한다.
-- upsert(onConflict: meeting_id,member_id)가 동작하려면 이 제약이 필요하다.
alter table scores
  add constraint scores_meeting_member_unique unique (meeting_id, member_id);
