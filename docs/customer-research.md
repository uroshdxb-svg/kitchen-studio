# Customer feedback and product updates

## Product flow

- Signup asks an optional, single-select “How did you find us?” alongside the existing profile. Answers: Google/search, AI assistant, Instagram, LinkedIn, YouTube, supplier, recommendation, other. Skipping never blocks signup, exports or existing accounts.
- Email signup stores the answer as `auth.users.raw_user_meta_data.discovery_source`. Google signup carries it in the existing pending-profile flow, then saves it with `auth.updateUser`. It is a self-reported survey answer, never an authorization claim. Returning users can answer in the research form; that answer is in the report context.
- The planner header has “What's new” with an unread dot. Reading it marks that release seen on this browser. Add truthful, shipped items to `RELEASES` in `engagement.js`; use a new release ID for a new unread badge. There is no automatic popup.
- “Help shape Kitchen Studio” is available from the menu and updates panel. Only goal and blocker are required. Alternative workflow, paid value, payment model, budget/currency and discovery source are optional.
- Research responses use the existing private `reports` inbox, with `context.type = customer_research`. No project file is attached. Keep existing RLS: client inserts only, no client reads. Free text, budgets and emails are not sent to analytics.
- Research-contact and product-update checkboxes are unchecked. Each response records both choices, a consent version and a timestamp. No mailing is automated by this change. Respect opt-outs received by reply and keep a suppression list before any campaign.
- A guest-provided address is unverified. Do not enroll it in email campaigns on the strength of that submission. The query below only returns reports tied to a verified account.

## First outreach round

1. Start with five verified, active kitchen owners. Exclude internal/test accounts manually; do not assume every account is a prospective customer.
2. Use individual invitations for a 15-minute research conversation. First invite a mix of repeat users and people who started but stopped. Keep this separate from product-update subscriptions.
3. Ask about their most recent real kitchen project, their current workflow and what it costs, the point where Kitchen Studio failed them, and the outcome worth paying for. Ask them to demonstrate a task if practical.
4. Only then discuss per-project, per-export, subscription or setup service. Record currency and period. Treat stated willingness as a hypothesis; later validate with a concrete paid pilot offer.
5. Group findings by role and use case. Prioritize recurring blockers that stop real projects. Publish the resulting shipped improvement in “What's new”. Tell the people who requested it when they have agreed to follow-up.

Suggested personal invitation (draft only):

“Hi [name], I'm Uroš, the chef building Kitchen Studio. I'm speaking with a few people using it to understand what is useful and what gets in the way. Would you be open to a 15-minute conversation about the kitchen you're planning and how you're handling it today? This is research, with no sales pitch.”

## Owner-only reporting

Run from the Supabase SQL editor or a trusted server, never a public browser client.

Signup source counts (self-reported; historical accounts may have no answer):

```sql
select coalesce(raw_user_meta_data->>'discovery_source', 'unknown') as discovery_source,
       count(*) as accounts
from auth.users
where email_confirmed_at is not null and not is_anonymous
group by 1 order by accounts desc;
```

Research inbox joined to account and usage context:

```sql
select r.id, r.created_at, u.email, p.country_code, p.professional_role,
       p.use_case, u.raw_user_meta_data->>'discovery_source' as signup_source,
       r.context, coalesce(k.kitchens,0) as kitchens, k.last_saved_at
from public.reports r
left join auth.users u on u.id=r.reporter
left join public.profiles p on p.id=r.reporter
left join lateral (
  select count(*) as kitchens, max(updated_at) as last_saved_at
  from public.projects where owner=r.reporter
) k on true
where r.context->>'type'='customer_research'
order by r.created_at desc;
```

Current contact preferences for verified accounts (latest report wins, including withdrawal):

```sql
with latest as (
  select distinct on (reporter) reporter, created_at, context
  from public.reports
  where context->>'type'='customer_research' and reporter is not null
  order by reporter, created_at desc, id desc
)
select u.id, u.email, l.created_at,
       coalesce(l.context->>'research_contact_consent','false')='true' as research_contact,
       coalesce(l.context->>'product_updates_consent','false')='true' as product_updates
from latest l join auth.users u on u.id=l.reporter
where u.email_confirmed_at is not null and not u.is_anonymous;
```

Apply reply-based suppressions as well as these preferences before sending. Consent in anonymous reports must not overwrite verified-account preferences. If a respondent changes their email, recheck the current account address and suppression list.

## Release validation

`node --test access.test.mjs cloud-profile.test.mjs analytics.test.mjs`

`node build.mjs && node engagement.browser.test.mjs`

The browser test serves built assets directly through Playwright request fixtures, so no localhost network access is needed. It checks phone layout, unread state, opt-in defaults, required contact address, failed-send recovery, private answer storage and signup source capture.
