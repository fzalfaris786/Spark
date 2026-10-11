# Final moderation specification

- 17 slash commands: `/ban`, `/unban`, `/kick`, `/softban`, `/timeout`, `/untimeout`, `/warn`, `/warnings`, `/clearwarnings`, `/purge`, `/slowmode`, `/lock`, `/unlock`, `/nick`, `/quarantine`, `/unquarantine`, `/modconfig`.
- Before `/ban`, `/kick`, and `/softban`, the bot attempts to DM the target with the action and reason. DM delivery failure is reported but never cancels the moderation action.
- Warning records are stored as embeds in a dedicated, private `#moderation-warnings` channel—not in MongoDB. `/warnings` reads the channel and `/clearwarnings` deletes that member's recorded warning messages.
- When moderation logs are disabled, existing warning records are cleared before the setting is changed. If the bot cannot read/delete warning records because of missing permissions, the command leaves logging enabled and reports the required permissions. No new warning history is saved while logs are disabled.
- Quarantine uses a dedicated no-permission role, channel overwrites, an optional appeal channel, and a saved role snapshot for restoration. MongoDB is strongly recommended for persistent settings and quarantine restoration. If the database is unavailable, fallback state is in memory and is lost when the process restarts.
- Successful action-history embeds go only to the configured moderation log channel; there is no MongoDB collection for generic action history or warning history.
- Code has been checked for JavaScript syntax. Live Discord behavior still needs testing in a private test server.
