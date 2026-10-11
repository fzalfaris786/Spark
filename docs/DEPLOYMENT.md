# Deployment checklist — review build

## Before starting

- Rotate credentials that may have been exposed in previous chat messages. Never commit or package `.env`.
- Use Node.js 22+. Set `BOT_TOKEN`, `CLIENT_ID`, `BOT_PREFIX`, `OWNER_IDS`, and, preferably, a valid `MONGODB_URI`/`MONGODB_DB_NAME`.
- In Discord Developer Portal → Application → Bot, enable **Server Members Intent** and **Message Content Intent**. The code subscribes to guild moderation, voice-state and message-reaction events as well.
- Invite the bot with OAuth2 scopes `bot` and `applications.commands`. Grant only permissions for features being tested, and place the bot role above roles it must manage.

## Install and verify

```bash
npm install
npm test
npm run deploy:commands
npm start
```

For a test guild, put its ID in `GUILD_ID` so slash commands register there quickly. Leave `GUILD_ID` blank to register globally.

## Recommended setup sequence in a private test server

1. **Logging:** `/logging-setup channel:#bot-logs`; then `/logging-test`.
2. **Welcome/Goodbye:** `/welcome-setup channel:#welcome`, `/goodbye-setup channel:#goodbye`, then use both `*-test` commands and customize templates.
3. **AutoRole:** `/autorole-add role:@Member target:member`; `/selfrole-add` for safe optional roles; publish via `/selfrole-panel`. Reaction-role mappings are created with `/reactionrole-add` using a message ID, emoji, role and optional channel.
4. **AutoMod:** `/automod-setup log_channel:#automod-logs`, run `/automod-test`, add any rules with `/automod-word-add`, check `/automod-status`, and only then test with `#general` messages.
5. **Tickets:** `/tickets-setup category:<category> support_role:@Support log_channel:#ticket-logs`, `/tickets-panel channel:#support`, then open a test ticket from a non-staff account. Verify claim, close, reopen, participant permissions and transcripts.
6. **Moderation:** configure `/modconfig`, test DMs disabled for `/ban`, `/kick`, `/softban`, and verify quarantine/release while MongoDB is connected.

## Permissions by feature

- Join events / member counts: Server Members Intent.
- Prefix commands, AutoMod message inspection and message content logs: Message Content Intent.
- AutoRole / self-role / reaction-role: Manage Roles and bot role above every role it assigns. Privileged roles are blocked from automatic/self/reaction assignment.
- AutoMod: Manage Messages to delete content; Moderate Members for timeout action; bot hierarchy above target members.
- Logging: View Channel, Send Messages and Embed Links in the chosen destination; Read Message History if you expect reliable message context.
- Tickets: Manage Channels, View Channel, Send Messages and Read Message History; Attach Files for transcript delivery. Support-role overwrites are applied to ticket channels.
- Moderation: relevant Ban Members, Kick Members, Moderate Members, Manage Messages, Manage Channels, Manage Roles and Manage Nicknames permissions. Role hierarchy still applies.

## Persistence and data-safety notes

- Guild module configuration is stored in MongoDB collections when connected. In-memory fallback is not durable and is lost on restart.
- Ticket channel topics store owner/status/claim state to aid inspection; ticket record upserts and configuration persistence still require MongoDB.
- AutoMod spam counters are in memory and reset on restart.
- Warning history is stored in the configured Discord warning channel, not a database warning collection.
- Ticket transcripts include up to the newest 1,000 messages; attachments are included as URLs, not downloaded. Limit access to transcript channels.
- Logging is based on gateway events and is not a replacement for Discord's audit log.

## Hosting

- **Railway:** set environment variables in the service Variables UI; do not upload `.env`. Check `/health` and `/ready`.
- **Linux VPS / PM2:** `npm install`, `npm test`, `npm run deploy:commands`, `npm start`; optionally `pm2 start ecosystem.config.cjs && pm2 save`. Keep one active process per bot token.

## Honest validation status

The JavaScript syntax checks passed, and the command loader/metadata suite passed against temporary lightweight API stubs because the real dependencies could not be installed in this environment. Re-run all checks with the actual installed `discord.js`/`mongodb` dependencies and perform a private-guild test before public deployment.
