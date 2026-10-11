# The Origin Labs Discord Bot — Moderation + Community Modules

Node.js 22+ · discord.js v14 · MongoDB · Railway and Linux VPS/PM2 compatible.

This review build preserves the Moderation module and adds **Welcome & Goodbye, AutoRole, AutoMod, Logging and Tickets**. Each command has its own `.js` file directly inside `src/modules/<module>/`. Module services and event handlers stay nested inside that module's own directory.

## Security and credentials

- Any bot token or database password pasted into chat should be treated as exposed. Rotate credentials before deployment.
- Never add `.env` or real credentials to Git or the ZIP. Copy `.env.example` to `.env`; deploy using host environment variables.
- Use least-privilege permissions and review each module's access rules. Do not grant Administrator merely to bypass configuration work.

## Quick start

1. Use Node.js 22 or later.
2. Copy `.env.example` to `.env` and set `BOT_TOKEN`, `CLIENT_ID`, `MONGODB_URI` (optional but strongly recommended), `MONGODB_DB_NAME`, `BOT_PREFIX`, and `OWNER_IDS`.
3. Run `npm install`.
4. Enable **Server Members Intent** and **Message Content Intent** in Discord Developer Portal → Application → Bot → Privileged Gateway Intents. Reaction roles also use the Guild Message Reactions intent configured in code.
5. Invite the bot with OAuth2 scopes `bot` and `applications.commands`, and grant only the permissions required by the modules you plan to use.
6. Run `npm test`, then `npm run deploy:commands`, then `npm start`.
7. For quick command propagation while testing, set `GUILD_ID` to your test server ID. Leave it blank for global registration.

## Folder layout

```text
src/
├── core/                         # Discord client and gateway intents
├── database/                     # MongoDB lifecycle
├── handlers/                     # Dynamic slash/prefix command loader
├── commands/                     # General commands (help, ping, bot info)
├── modules/
│   ├── moderation/               # 17 commands, each a separate file
│   ├── welcome-goodbye/          # 12 slash commands + !welcome / !goodbye groups
│   ├── autorole/                 # 12 commands, join/reaction/button roles
│   ├── automod/                  # 10 commands and message filtering
│   ├── logging/                  # 6 commands and event listeners
│   ├── tickets/                  # 14 commands, buttons, modal and transcripts
│   ├── runtime.js                # Wires module events/interactions
│   ├── commandFactory.js         # Shared command metadata and response helpers
│   └── prefixAdapter.js          # Shared prefix adapter for command implementations
└── utils/                        # Shared embeds and preserved moderation engine
```

The command loader scans top-level `.js` files inside each module directory. Supporting `services/` and `events/` files are not treated as commands. New direct command files are discovered on startup and included in command deployment automatically.

## Moderation — 17 commands

| Command | Purpose |
|---|---|
| `/ban` | Attempts a DM before ban; action proceeds even if DM fails. |
| `/unban` | Remove a ban by user ID. |
| `/kick` | Attempts a DM before kick; action proceeds even if DM fails. |
| `/softban` | Attempts a DM, bans to clear selected recent messages, then unbans. |
| `/timeout`, `/untimeout` | Apply or remove a timeout. |
| `/warn`, `/warnings`, `/clearwarnings` | Post, inspect and clear warning history in the configured Discord warning channel. |
| `/purge` | Delete 1–100 recent messages. Discord does not bulk-delete messages older than 14 days. |
| `/slowmode` | Configure a channel slowmode delay. |
| `/lock`, `/unlock` | Toggle @everyone message-send permission in a channel. |
| `/nick` | Set or reset a nickname. |
| `/quarantine`, `/unquarantine` | Isolate a member and restore eligible saved roles. MongoDB is strongly recommended for restart-safe role snapshots. |
| `/modconfig` | Configure moderation logs, warning channel and quarantine appeal channel. |

### Moderation notes

- DMs are attempted before `/ban`, `/kick` and `/softban`; DM failure does not cancel the action.
- Warning history lives in the configured Discord channel, not a MongoDB warning collection.
- Quarantine snapshots/settings fall back to memory if MongoDB is unavailable; in-memory state is lost on restart.

## Welcome & Goodbye — 12 commands

| Command | Purpose |
|---|---|
| `/welcome-setup` | Choose the welcome channel and optional image/GIF URL; enables welcome messages. |
| `/welcome-config` | Configure DM attempts, avatar thumbnail, image/GIF banner and embed color. |
| `/welcome-message` | Set a custom welcome template. |
| `/welcome-enable`, `/welcome-disable` | Toggle welcome events. |
| `/welcome-test` | Preview the welcome embed in the current channel. |
| `/goodbye-setup` | Choose the leave-message channel and optional image/GIF URL. |
| `/goodbye-config` | Configure avatar thumbnail, image/GIF banner and embed color. |
| `/goodbye-message` | Set a custom goodbye template. |
| `/goodbye-enable`, `/goodbye-disable` | Toggle goodbye events. |
| `/goodbye-test` | Preview the goodbye embed. |

Template placeholders: `{user}`, `{username}`, `{server}`, `{memberCount}`, `{userId}`, `{createdAt}`. Banner/image URLs may also use `{username}`, `{server}`, `{memberCount}`, `{userId}`, `{createdAt}` and `{avatar}`; these are URL-encoded before the bot places the final URL into the embed. Prefix group shortcuts are also available: `!welcome setup`, `!welcome config`, `!welcome message`, `!welcome enable`, `!welcome disable`, `!welcome test`, and the same six subcommands under `!goodbye`. Image URLs may point to static images, GIFs or external dynamic image services; the bot does not generate animated image files locally. DM delivery cannot be guaranteed.

## AutoRole — 12 commands

| Command | Purpose |
|---|---|
| `/autorole-add` | Add a join role for human members, bots or both (up to 25 roles per target group). |
| `/autorole-remove` | Remove an automatic assignment rule without stripping existing roles. |
| `/autorole-list` | Show join roles and configured self-roles. |
| `/autorole-enable`, `/autorole-disable` | Toggle join-role assignment. |
| `/selfrole-add`, `/selfrole-remove`, `/selfrole-list` | Manage the safe self-assignable role list and descriptions. |
| `/selfrole-panel` | Post up to 25 toggle buttons; members click to add/remove a role. |
| `/reactionrole-add`, `/reactionrole-remove`, `/reactionrole-list` | Map Unicode or custom emoji reactions on a message to a role. Adding/removing a reaction adds/removes the configured role. |

Safety checks prevent the bot from assigning roles above its role, managed roles, and roles with administrator/moderation/server-management permissions. The bot needs Manage Roles and the relevant channel permissions. Removing a reaction-role mapping does not remove roles already assigned.

## AutoMod — 10 commands

| Command | Purpose |
|---|---|
| `/automod-setup` | Enable baseline protection and optionally set the violation log channel. |
| `/automod-enable`, `/automod-disable` | Toggle filtering. |
| `/automod-status` | View active settings. |
| `/automod-config` | Configure response (delete, delete+warn, delete+timeout), invite/link filters, anti-spam window and thresholds, mention limit, and caps-filter percentage/minimum length. |
| `/automod-word-add`, `/automod-word-remove`, `/automod-word-list` | Maintain up to 100 blocked words/phrases. |
| `/automod-exempt` | Add/remove a role or channel exemption. |
| `/automod-test` | Test sample text without deleting a real message or applying punishment. |

When a configured violation is detected, the offending message is deleted. `warn` also posts a short public notice; `timeout` attempts the configured timeout if Discord permissions and role hierarchy allow it. Spam-rate state is in memory and resets on restart. Managers and exempt roles/channels are bypassed. Review filters in a test server to avoid false positives.

## Logging — 6 commands

| Command | Purpose |
|---|---|
| `/logging-setup` | Select the log channel and enable event logging. |
| `/logging-enable`, `/logging-disable` | Toggle logging while preserving configuration. |
| `/logging-status` | Display current logging configuration. |
| `/logging-config` | Enable/disable event groups: messages, members, moderation, channels, roles, voice and server settings. |
| `/logging-test` | Send a test entry. |

Events include message edits/deletions/bulk deletes, member joins/leaves/nickname/role changes, timeout changes, bans/unbans, channel and role changes, voice-channel movement, and visible server setting changes. Logs are based on events delivered to the bot; they are not a replacement for Discord's audit log and do not always reveal who initiated an action.

## Tickets 🎟️ — 14 commands

| Command | Purpose |
|---|---|
| `/tickets-setup` | Choose ticket category, optional support role and log/transcript channel. |
| `/tickets-panel` | Publish the ticket-opening panel. Button opens a modal for subject and issue details. |
| `/tickets-config` | Adjust support role, transcript channel and per-member open-ticket limit; optional clear flags remove role/channel settings. |
| `/tickets-enable`, `/tickets-disable`, `/tickets-status` | Control and inspect ticket creation. Disabling new tickets does not delete existing ones. |
| `/ticket-close` | Close a ticket, make the creator's channel read-only and attempt transcript archival. |
| `/ticket-claim` | Let support staff claim an open ticket. |
| `/ticket-reopen` | Reopen a closed ticket (staff only). |
| `/ticket-add`, `/ticket-remove` | Add/remove a participant from ticket channel access. The owner cannot be removed. |
| `/ticket-rename` | Rename the current ticket channel. |
| `/ticket-transcript` | Export a transcript (up to the latest 1,000 messages) as a text file or send it to the configured log channel. Attachments are represented by URLs, not downloaded into the transcript. |
| `/tickets-stats` | Show open/closed ticket channel counts. |

Tickets are private by default to the creator, configured support role and bot. The bot needs Manage Channels, View Channel, Send Messages and Read Message History; add Attach Files for transcript delivery. Transcripts can contain sensitive information—limit who can view the transcript channel.

## Prefix commands

Every module slash command is also available by its command name with the configured prefix (for example, `!welcome-test`, `!automod-status`, or `!ticket-transcript`). Welcome and goodbye also support the shorter group form `!welcome test` / `!goodbye test`. For prefix role/user/channel arguments use mentions and follow the command's option order. Slash commands give better guided validation, so they are recommended for commands with several optional arguments.

## Database and recovery

Module settings use the shared MongoDB-backed settings store. If MongoDB is not configured/reachable, the project falls back to in-memory settings; those settings do not survive restart. Ticket record upserts require MongoDB, while active channel state can still be inspected from ticket channel topics. Keep MongoDB working before relying on persistent configuration. See `docs/NEXT-MODULES-REVIEW.md` and `docs/DEPLOYMENT.md` for limitations and setup checks.

## Deployment

- **Railway:** configure variables through the Variables UI; do not upload `.env`. Railway's `PORT` is used for the health server.
- **Linux VPS/PM2:** `npm install`, `npm test`, `npm run deploy:commands`, `npm start`; optionally `pm2 start ecosystem.config.cjs && pm2 save`.
- Run one bot process per token to avoid duplicate event responses.
- Always test with a private server first and verify every permission-dependent path before public deployment.

## Validation status

JavaScript syntax checks passed. The command-loader and metadata test suite passed against temporary lightweight API stubs because the real dependencies could not be installed (the npm installation attempt timed out). This does not confirm the official discord.js builder validation or live Discord behavior. Run `npm install`, `npm test`, `npm run deploy:commands` and a private-server integration test before production use.
