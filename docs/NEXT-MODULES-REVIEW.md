# The Origin Labs Discord Bot — Module Review Build

This build contains the existing moderation command set plus five integrated modules: Welcome & Goodbye, AutoRole, AutoMod, Logging and Tickets. Each command is a separate JavaScript file directly inside its module folder. Shared logic, event handlers and supporting functions are nested under that same module's `services/` or `events/` directories.

## Important Discord Developer Portal settings

Enable **Server Members Intent** and **Message Content Intent** under Bot → Privileged Gateway Intents. This build also subscribes to guild moderation and voice-state events through the corresponding gateway intents. Invite the bot with the slash command scope and only the permissions needed for enabled modules.

## Persistence

Guild settings use the shared MongoDB-backed settings store. If MongoDB is unavailable, the shared store falls back to in-memory settings; those settings do not survive process restart. Ticket metadata and transcripts are saved to Discord channels as practical, and ticket records are upserted to MongoDB when available. Quarantine role snapshots likewise need MongoDB for reliable restart persistence.

## Permission notes

- Manage Server is needed for module setup/configuration except role management commands, which require Manage Roles.
- The bot needs role hierarchy above roles it assigns or changes.
- Welcome/goodbye need View Channel, Send Messages and Embed Links in their configured channels.
- AutoMod needs Manage Messages to delete violating messages and Moderate Members to apply timeouts.
- Logging needs View Channel, Send Messages and Embed Links in the configured log channel.
- Tickets need Manage Channels, View Channel, Send Messages, Read Message History, and Attach Files if transcripts are desired.

## Review limitations

- Welcome/goodbye banner URLs can be static images/GIFs or external dynamic image service URLs using `{username}`, `{server}`, `{memberCount}`, `{userId}`, `{createdAt}` and `{avatar}` placeholders. This bot does not render/generate GIFs locally.
- Prefix commands are generated from the slash-command option schema. For guided options and best validation, use slash commands. For prefix role/user/channel options, use Discord mentions such as `@Role`, `#channel`, or `@user`.
- AutoMod rate-limit state is in memory and resets on restart. The blocked-word list/config persists through shared settings when MongoDB is connected.
- Logging observes events that Discord's gateway delivers; it is not a replacement for Discord's native audit log and cannot identify the responsible actor for every event.
- Ticket transcripts include up to the most recent 1,000 messages per export. Message attachment content is not downloaded; attachment URLs are included.
- A code/syntax review cannot verify permissions or behavior inside a live Discord server. Perform a test-server run before production deployment.

## Pros, trade-offs and next improvements

### Welcome & Goodbye
- **Pros:** Per-server channel/message/color/avatar settings; safe mention handling; DM attempts are optional and do not affect channel posting; dynamic banner templates can use member-count/account placeholders; GIF URLs can animate in Discord embeds.
- **Trade-offs:** The bot does not render image/GIF frames locally. The server administrator supplies an image/GIF URL or an external dynamic-image endpoint. DM delivery can fail because of member privacy settings.
- **Good next improvement:** Add an optional locally-rendered image-card renderer with a controlled theme gallery, plus an explicit image-cache policy.

### AutoRole
- **Pros:** Separate human/bot join-role rules, safe self-role buttons, Unicode/custom-emoji reaction roles, hierarchy checks and a block on self-assigning privileged roles.
- **Trade-offs:** 25 join roles per target group, 25 self-roles and 100 reaction-role mappings per server. Removing a reaction mapping does not remove roles already granted; an old panel should be republished after self-role configuration changes.
- **Good next improvement:** Add scheduled mapping-health checks and an administrator-controlled cleanup tool for roles that were granted by a now-removed mapping.

### AutoMod
- **Pros:** Invite/link filters, blocked words/phrases, repeated/rate spam, mention spam, excessive caps, exemptions and configurable delete/warn/timeout responses.
- **Trade-offs:** Text-based filtering only; it does not inspect image text or attachment contents. Spam rate counters are in memory and reset on restart. Rules can have false positives, so the test command and a staged rollout are recommended.
- **Good next improvement:** Add configurable escalating actions and a database-backed violation history with a privacy-aware retention period.

### Logging
- **Pros:** Seven toggleable event categories and a test command; uses consistent branded embeds and sanitizes mass-mention text.
- **Trade-offs:** Only gateway-delivered events can be logged; actor attribution is unavailable for many event types without audit-log correlation. Message content logging requires the privileged Message Content intent and should be disclosed to members.
- **Good next improvement:** Add optional audit-log correlation, configurable content redaction and automatic log retention/rotation.

### Tickets
- **Pros:** Private channels, modal intake, support role, claims, close/reopen, participant management, limit per user, transcripts and ticket event logs. Ticket creation cleans up a channel if initialization fails.
- **Trade-offs:** A transcript includes up to the latest 1,000 messages and attachment URLs rather than attachment file contents. Administrators with Discord's Administrator permission can still bypass channel overwrites. MongoDB improves ticket-record persistence; channel topics also carry active owner/status/claim state.
- **Good next improvement:** Add configurable transcript retention, HTML transcripts and optional per-ticket priority/category fields.

## Validation performed for this review build

- All JavaScript source and test files passed `node --check`.
- `npm test` passed 13 tests, including command metadata/file layout, dynamic command discovery (74 slash and 75 prefix commands), blocked-word/link logic, reaction emoji parsing, welcome template generation and ticket topic/name parsing.
- The dependency install timed out in this environment. The tests therefore ran against temporary lightweight `discord.js`/`mongodb` test stubs; they do not validate the official builder's full runtime behavior or a live Discord server. The temporary stubs are development-only and must not be included in a ZIP; a fresh `npm install` will install the actual dependencies.
