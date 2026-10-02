# Social launch checklist

Content, bios and the first launch week are in [launch-pack.md](launch-pack.md).

Login for every account: `social@kitchenstudio.design`. Passwords live in the password manager, never in this repo.

## Accounts

| Channel | Handle | Created | Profile done (photo, bio, link) | Connected to Buffer | URL in `site.config.json` |
| --- | --- | --- | --- | --- | --- |
| Buffer | social@kitchenstudio.design | ✅ | n/a | n/a | n/a |
| Instagram | `@kitchenstudio.design` | ⏳ sign-up submitted by hand (birthday/age check) | ☐ | ☐ | ☐ |
| Threads | `@kitchenstudio.design` (comes from Instagram) | ☐ | ☐ | ☐ | ☐ |
| TikTok | `@kitchenstudio.design` (fallback `@kitchenstudioapp`) | ☐ | ☐ | ☐ | ☐ |
| YouTube | `@kitchenstudio.design` (fallback `@kitchenstudioapp`) | ☐ | ☐ | ☐ | ☐ |
| LinkedIn | Company page "Kitchen Studio" | ☐ | ☐ (tagline + about in the pack) | ☐ | ☐ |

Decision still open: link the Instagram account to the existing personal Meta Accounts Center, or keep it separate.

## Per account, once created

1. Profile photo: the orange KS mark (`/logo-icon.svg` on the site, export to PNG at 1080×1080).
2. Bio and description from the launch pack. The website link carries the channel's UTM (`utm_source=<channel>&utm_medium=social&utm_campaign=launch`).
3. Instagram and Threads: switch to a professional account, category Software / Product service. TikTok: business account. LinkedIn: company page with the tagline and about text.
4. Connect the channel in Buffer.
5. Put the public profile URL into `site.config.json` → `social.<channel>` and push. The build adds it to the site footer, the "Use with AI" page footer and the follow-along line. Empty or non-https values are left out.

## Launch week

- [ ] Post 1: launch tour reel (video still to be verified/regenerated)
- [ ] Post 2: launch carousel (6 slides ready)
- [ ] Post 3: template to drawing set
- [ ] Post 4: pass-distance mistake
