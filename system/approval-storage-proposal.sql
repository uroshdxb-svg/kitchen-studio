-- REVIEW PROPOSAL ONLY. NOT A MIGRATION; NOT APPLIED BY THE BUILD.
-- Applying this creates new security/storage configuration and requires explicit
-- approval. It intentionally provisions NO approver, consumer or credential.
-- A trusted integration must mirror authoritative current task/action versions,
-- create requests, consume the outbox through the EXISTING execution route and
-- insert acknowledgements only after actual worker acceptance. The worker must
-- independently re-read the authoritative queue/head before every side effect.
-- An approval receipt is human intent, never proof of permission to skip CI,
-- required reviews, resource ownership, publication QA or release verification.
begin;
create schema system_approvals;
revoke all on schema system_approvals from public, anon, authenticated;

create table system_approvals.runtime (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false,
  consumer_verified_until timestamptz,
  consumer_proof_reference text,
  check(not enabled or (consumer_verified_until is not null and length(consumer_proof_reference) between 1 and 500))
);
insert into system_approvals.runtime(singleton) values(true);
create table system_approvals.approvers (
  user_id uuid primary key references auth.users(id),
  allowed_actions text[] not null check(cardinality(allowed_actions)>0),
  enabled boolean not null default false
);
-- Trusted current-source mirror. No browser may create/change these rows.
-- valid_until is a short bounded freshness window, not a substitute for a worker's
-- final authoritative read. Explicit source evidence accompanies every version.
create table system_approvals.subjects (
  id uuid primary key default gen_random_uuid(), task_id text not null unique check(length(task_id) between 1 and 120),
  version bigint not null check(version>0), generation bigint not null check(generation>=0),
  status text not null check(status in('needs_approval','changed','closed')),
  action text not null check(action in('catalogue.release','system.release','content.publish','content.schedule','task.continue')),
  target_version text not null check(length(target_version) between 1 and 240),
  source_reference text not null check(length(source_reference) between 1 and 500),
  checked_at timestamptz not null, valid_until timestamptz not null,
  check(valid_until>checked_at and valid_until<=checked_at+interval '5 minutes')
);
create table system_approvals.requests (
  id uuid primary key default gen_random_uuid(), subject_id uuid not null references system_approvals.subjects(id),
  version bigint not null check(version>0), subject_version bigint not null check(subject_version>0),
  generation bigint not null check(generation>=0), designated_approver uuid not null references system_approvals.approvers(user_id),
  title text not null check(length(title) between 1 and 200),
  action text not null check(action in('catalogue.release','system.release','content.publish','content.schedule','task.continue')),
  target_version text not null check(length(target_version) between 1 and 240),
  expires_at timestamptz not null, created_at timestamptz not null default now(),
  status text not null default 'pending' check(status in('pending','approved','stale')),
  chat_url text check(chat_url ~ '^https://chatgpt[.]com/c/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'),
  chat_verification_reference text,
  check(chat_url is null or (chat_verification_reference is not null and length(chat_verification_reference) between 1 and 500)),
  check(expires_at>created_at), unique(subject_id,subject_version)
);
-- A source identity cannot be repurposed for another task. Any decision binding
-- change advances its version; refreshing only the read freshness keeps it stable.
create function system_approvals.fence_subject() returns trigger
language plpgsql set search_path='' as $$begin
  if new.id is distinct from old.id or new.task_id is distinct from old.task_id then
    raise exception 'Immutable source identity'; end if;
  if new.version<old.version or new.generation<old.generation then
    raise exception 'Source generation/version cannot move backwards'; end if;
  if row(new.generation,new.status,new.action,new.target_version) is distinct from row(old.generation,old.status,old.action,old.target_version)
    and new.version<=old.version then raise exception 'Changed source requires a new version'; end if;
  return new;
end$$;
create trigger subjects_fenced before update on system_approvals.subjects for each row execute function system_approvals.fence_subject();
create table system_approvals.receipts (
  id uuid primary key default gen_random_uuid(), request_id uuid not null unique references system_approvals.requests(id),
  request_version bigint not null, approver uuid not null references auth.users(id),
  idempotency_key uuid not null, approved_at timestamptz not null default now(),
  -- Immutable exact decision snapshot remains valid audit history even after work changes.
  task_id text not null, subject_version bigint not null, generation bigint not null,
  action text not null, target_version text not null, unique(approver,idempotency_key)
);
create table system_approvals.outbox (
  receipt_id uuid primary key references system_approvals.receipts(id),
  created_at timestamptz not null default now()
);
create table system_approvals.acknowledgements (
  receipt_id uuid primary key references system_approvals.outbox(receipt_id),
  acknowledged_at timestamptz not null,
  worker_reference text not null check(length(worker_reference) between 1 and 500),
  queue_receipt_reference text not null check(length(queue_receipt_reference) between 1 and 500)
);
-- RLS defense in depth; no customer SELECT/INSERT/UPDATE/DELETE policies exist.
alter table system_approvals.runtime enable row level security;
alter table system_approvals.approvers enable row level security;
alter table system_approvals.subjects enable row level security;
alter table system_approvals.requests enable row level security;
alter table system_approvals.receipts enable row level security;
alter table system_approvals.outbox enable row level security;
alter table system_approvals.acknowledgements enable row level security;
revoke all on all tables in schema system_approvals from public, anon, authenticated;

create function system_approvals.immutable_audit() returns trigger
language plpgsql set search_path='' as $$begin raise exception 'Immutable audit record'; end$$;
create trigger receipts_immutable before update or delete on system_approvals.receipts for each row execute function system_approvals.immutable_audit();
create trigger outbox_immutable before update or delete on system_approvals.outbox for each row execute function system_approvals.immutable_audit();
create trigger acknowledgements_immutable before update or delete on system_approvals.acknowledgements for each row execute function system_approvals.immutable_audit();

-- Request IDs/versions name immutable intent. A changed head, task generation,
-- designated human, expiry or verified conversation requires a NEW request and
-- current subject version; it must never silently change beneath an open tab.
create function system_approvals.immutable_request_binding() returns trigger
language plpgsql set search_path='' as $$begin
  if tg_op='DELETE' then raise exception 'Immutable approval request'; end if;
  if (to_jsonb(new)-'status') is distinct from (to_jsonb(old)-'status') then
    raise exception 'Approval binding is immutable; create a new versioned request'; end if;
  if new.status=old.status then return new; end if;
  if old.status<>'pending' or new.status not in('approved','stale') then
    raise exception 'Invalid approval state transition'; end if;
  if new.status='approved' and not exists(select 1 from system_approvals.receipts d
      where d.request_id=old.id and d.request_version=old.version
      and d.approver=old.designated_approver and d.subject_version=old.subject_version
      and d.generation=old.generation and d.action=old.action and d.target_version=old.target_version) then
    raise exception 'Immutable durable decision receipt required'; end if;
  return new;
end$$;
create trigger request_binding_immutable before update or delete on system_approvals.requests
for each row execute function system_approvals.immutable_request_binding();

create function system_approvals.ack_time_valid() returns trigger
language plpgsql set search_path='' as $$begin
  if not exists(select 1 from system_approvals.receipts d where d.id=new.receipt_id
      and new.acknowledged_at>=d.approved_at and new.acknowledged_at<=clock_timestamp()) then
    raise exception 'Acknowledgement must follow its actual decision'; end if;
  return new;
end$$;
create trigger acknowledgement_time_valid before insert on system_approvals.acknowledgements
for each row execute function system_approvals.ack_time_valid();

-- SECURITY DEFINER is narrowly required to read server-owned private tables.
-- No arbitrary SQL, user ID, action, target or chat URL is accepted from a client.
create function system_approvals.guard(p_require_consumer boolean default true) returns uuid
language plpgsql security definer set search_path='' as $$
declare uid uuid:=auth.uid(); begin
  if uid is null then raise sqlstate 'PT401' using message='Sign in required'; end if;
  if not exists(select 1 from system_approvals.approvers a where a.user_id=uid and a.enabled) then
    raise sqlstate 'PT403' using message='Not authorized'; end if;
  if not exists(select 1 from system_approvals.runtime r where r.singleton) then
    raise sqlstate 'PT503' using message='Private approvals unavailable'; end if;
  if p_require_consumer and not exists(select 1 from system_approvals.runtime r where r.singleton and r.enabled and r.consumer_verified_until>clock_timestamp() and r.consumer_proof_reference is not null) then
    raise sqlstate 'PT503' using message='Private approvals unavailable'; end if;
  return uid;
end$$;

create function system_approvals.is_current(r system_approvals.requests,s system_approvals.subjects) returns boolean
language sql volatile set search_path='' as $$select r.status='pending' and r.expires_at>clock_timestamp()
  and s.status='needs_approval' and s.checked_at<=clock_timestamp() and s.valid_until>clock_timestamp()
  and r.subject_version=s.version and r.generation=s.generation and r.action=s.action and r.target_version=s.target_version$$;

create function system_approvals.summary(r system_approvals.requests,s system_approvals.subjects) returns jsonb
language sql volatile set search_path='' as $$
select jsonb_build_object('id',r.id,'version',r.version,'taskId',s.task_id,'title',r.title,
  'action',r.action,'targetVersion',r.target_version,
  'status',case when a.receipt_id is not null then 'acknowledged' when r.status='approved' then 'approved' when system_approvals.is_current(r,s) then 'pending' else 'stale' end,
  'expiresAt',r.expires_at,'chatUrl',r.chat_url,'workerAcknowledgedAt',a.acknowledged_at,
  'canApprove',system_approvals.is_current(r,s))
from (values(1)) seed(x) left join system_approvals.receipts d on d.request_id=r.id
left join system_approvals.acknowledgements a on a.receipt_id=d.id
$$;

create function public.system_approval_list() returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=system_approvals.guard(false); result jsonb; ready boolean; begin
  select exists(select 1 from system_approvals.runtime r where r.singleton and r.enabled and r.consumer_verified_until>clock_timestamp() and r.consumer_proof_reference is not null) into ready;
  select coalesce(jsonb_agg(x.value order by x.created_at desc),'[]'::jsonb) into result
  from (select case when ready then system_approvals.summary(r,s) else jsonb_set(system_approvals.summary(r,s),'{canApprove}','false'::jsonb) end value,r.created_at from system_approvals.requests r
    join system_approvals.subjects s on s.id=r.subject_id
    join system_approvals.approvers a on a.user_id=uid and a.enabled and r.action=any(a.allowed_actions)
    where r.designated_approver=uid order by r.created_at desc limit 100) x;
  return jsonb_build_object('requests',result,'consumerReady',ready);
end$$;

create function public.system_approval_decide(p_request uuid,p_version bigint,p_idempotency uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare uid uuid:=system_approvals.guard(); r system_approvals.requests; s system_approvals.subjects; d system_approvals.receipts; sid uuid; begin
  if p_version is null or p_version<1 or p_idempotency is null then raise sqlstate 'PT409' using message='Invalid decision'; end if;
  -- Lock the subject before its request; trusted mirror updates must use the same
  -- subject lock. This serializes current-source changes with the decision.
  select subject_id into sid from system_approvals.requests where id=p_request and designated_approver=uid;
  if sid is null then raise sqlstate 'PT403' using message='Not authorized'; end if;
  select * into s from system_approvals.subjects where id=sid for update;
  select * into r from system_approvals.requests where id=p_request for update;
  perform system_approvals.guard(); -- consumer may have expired while waiting for locks
  if r.designated_approver<>uid or not exists(select 1 from system_approvals.approvers a where a.user_id=uid and a.enabled and r.action=any(a.allowed_actions)) then raise sqlstate 'PT403' using message='Not authorized'; end if;
  select * into d from system_approvals.receipts where approver=uid and idempotency_key=p_idempotency;
  if found then
    if d.request_id<>r.id or d.request_version<>p_version then raise sqlstate 'PT409' using message='Idempotency collision'; end if;
    return jsonb_build_object('request',system_approvals.summary(r,s),'receiptId',d.id,'approvedAt',d.approved_at,'consumerReady',true);
  end if;
  if r.version<>p_version or not system_approvals.is_current(r,s) then raise sqlstate 'PT409' using message='Approval changed'; end if;
  insert into system_approvals.receipts(request_id,request_version,approver,idempotency_key,task_id,subject_version,generation,action,target_version)
    values(r.id,r.version,uid,p_idempotency,s.task_id,r.subject_version,r.generation,r.action,r.target_version) returning * into d;
  insert into system_approvals.outbox(receipt_id) values(d.id);
  update system_approvals.requests set status='approved' where id=r.id returning * into r;
  return jsonb_build_object('request',system_approvals.summary(r,s),'receiptId',d.id,'approvedAt',d.approved_at,'consumerReady',true);
exception when unique_violation then raise sqlstate 'PT409' using message='Decision already recorded; refresh';
end$$;
revoke all on all functions in schema system_approvals from public, anon, authenticated;
revoke all on function public.system_approval_list() from public, anon, authenticated;
revoke all on function public.system_approval_decide(uuid,bigint,uuid) from public, anon, authenticated;
grant execute on function public.system_approval_list() to authenticated;
grant execute on function public.system_approval_decide(uuid,bigint,uuid) to authenticated;
-- Deliberately no INSERTs of users, requests or consumer proofs; no consumer role,
-- secret or public permissions. Production remains disabled after applying this
-- proposal until separately authorized configuration and end-to-end verification.
commit;
