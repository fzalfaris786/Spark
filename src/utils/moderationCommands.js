import {ChannelType, PermissionFlagsBits, SlashCommandBuilder} from "discord.js";
import {brandEmbed, errorEmbed, infoEmbed, successEmbed, warningEmbed} from "./embeds.js";
import {
  deleteQuarantine, getModerationSettings,
  getQuarantine, saveQuarantine, updateModerationSettings,
} from "../services/moderationStore.js";

const P = PermissionFlagsBits;
const MAX_REASON = 400;
const TEXT_CHANNEL_TYPES = [ChannelType.GuildText, ChannelType.GuildAnnouncement];
const specs = {
  ban: {description: "Ban a member from this server.", permission: P.BanMembers, botPermission: P.BanMembers, member: true, options: [
    {type: "user", name: "member", description: "Member to ban", required: true},
    {type: "string", name: "reason", description: "Reason for the ban", max: MAX_REASON},
    {type: "integer", name: "delete_message_days", description: "Recent message history to delete (0–7 days)", min: 0, max: 7},
  ]},
  unban: {description: "Remove a user's ban using their Discord ID.", permission: P.BanMembers, botPermission: P.BanMembers, options: [
    {type: "string", name: "user_id", description: "Discord user ID to unban", required: true},
    {type: "string", name: "reason", description: "Reason for the unban", max: MAX_REASON},
  ]},
  kick: {description: "Kick a member from this server.", permission: P.KickMembers, botPermission: P.KickMembers, member: true, options: [
    {type: "user", name: "member", description: "Member to kick", required: true},
    {type: "string", name: "reason", description: "Reason for the kick", max: MAX_REASON},
  ]},
  softban: {description: "Ban and immediately unban a member to clear recent messages.", permission: P.BanMembers, botPermission: P.BanMembers, member: true, options: [
    {type: "user", name: "member", description: "Member to softban", required: true},
    {type: "integer", name: "delete_message_days", description: "Recent message history to delete (0–7 days)", min: 0, max: 7},
    {type: "string", name: "reason", description: "Reason for the softban", max: MAX_REASON},
  ]},
  timeout: {description: "Timeout a member for a chosen duration.", permission: P.ModerateMembers, botPermission: P.ModerateMembers, member: true, options: [
    {type: "user", name: "member", description: "Member to timeout", required: true},
    {type: "integer", name: "duration_minutes", description: "Duration in minutes (1–40320)", required: true, min: 1, max: 40320},
    {type: "string", name: "reason", description: "Reason for the timeout", max: MAX_REASON},
  ]},
  untimeout: {description: "Remove a member's active timeout.", permission: P.ModerateMembers, botPermission: P.ModerateMembers, member: true, options: [
    {type: "user", name: "member", description: "Member to untimeout", required: true},
    {type: "string", name: "reason", description: "Reason for removing the timeout", max: MAX_REASON},
  ]},
  warn: {description: "Issue a warning and record it in the dedicated channel when logs are enabled.", permission: P.ModerateMembers, member: true, options: [
    {type: "user", name: "member", description: "Member to warn", required: true},
    {type: "string", name: "reason", description: "Reason for the warning", required: true, max: MAX_REASON},
  ]},
  warnings: {description: "View a member's recorded warnings.", permission: P.ModerateMembers, options: [
    {type: "user", name: "member", description: "Member whose warnings to view", required: true},
  ]},
  clearwarnings: {description: "Clear a member's recorded warnings.", permission: P.ModerateMembers, options: [
    {type: "user", name: "member", description: "Member whose warnings to clear", required: true},
    {type: "string", name: "reason", description: "Reason for clearing warnings", max: MAX_REASON},
  ]},
  purge: {description: "Delete up to 100 recent messages from a text channel.", permission: P.ManageMessages, botPermission: P.ManageMessages, options: [
    {type: "integer", name: "amount", description: "Number of messages to delete (1–100)", required: true, min: 1, max: 100},
    {type: "channel", name: "channel", description: "Channel to clean (defaults to current)", channels: true},
    {type: "string", name: "reason", description: "Reason for cleaning messages", max: MAX_REASON},
  ]},
  slowmode: {description: "Set or disable a channel's slowmode delay.", permission: P.ManageChannels, botPermission: P.ManageChannels, options: [
    {type: "integer", name: "seconds", description: "Delay in seconds (0 disables; max 21600)", required: true, min: 0, max: 21600},
    {type: "channel", name: "channel", description: "Channel to update (defaults to current)", channels: true},
    {type: "string", name: "reason", description: "Reason for the change", max: MAX_REASON},
  ]},
  lock: {description: "Lock a text channel for @everyone.", permission: P.ManageChannels, botPermission: P.ManageChannels, options: [
    {type: "channel", name: "channel", description: "Channel to lock (defaults to current)", channels: true},
    {type: "string", name: "reason", description: "Reason for locking", max: MAX_REASON},
  ]},
  unlock: {description: "Unlock a text channel for @everyone.", permission: P.ManageChannels, botPermission: P.ManageChannels, options: [
    {type: "channel", name: "channel", description: "Channel to unlock (defaults to current)", channels: true},
    {type: "string", name: "reason", description: "Reason for unlocking", max: MAX_REASON},
  ]},
  nick: {description: "Set or reset a member's server nickname.", permission: P.ManageNicknames, botPermission: P.ManageNicknames, member: true, options: [
    {type: "user", name: "member", description: "Member whose nickname to update", required: true},
    {type: "string", name: "nickname", description: "New nickname; omit to reset (max 32 chars)", max: 32},
    {type: "string", name: "reason", description: "Reason for the change", max: MAX_REASON},
  ]},
  quarantine: {description: "Isolate a member and save their current roles for restoration.", permission: P.ManageRoles, botPermission: P.ManageRoles, member: true, options: [
    {type: "user", name: "member", description: "Member to quarantine", required: true},
    {type: "string", name: "reason", description: "Reason for quarantine", max: MAX_REASON},
  ]},
  unquarantine: {description: "Release a member and restore eligible saved roles.", permission: P.ManageRoles, botPermission: P.ManageRoles, member: true, options: [
    {type: "user", name: "member", description: "Member to release", required: true},
    {type: "string", name: "reason", description: "Reason for release", max: MAX_REASON},
  ]},
  modconfig: {description: "Configure moderation logs, warning-channel setup, and quarantine appeals.", permission: P.ManageGuild, options: [
    {type: "channel", name: "logs_channel", description: "Set the moderation action log channel", channels: true},
    {type: "boolean", name: "disable_logs", description: "Set true to disable action logs and clear warning history"},
    {type: "boolean", name: "setup_warning_channel", description: "Create and configure the private warning-history channel"},
    {type: "channel", name: "appeal_channel", description: "Channel quarantined members can see and write in", channels: true},
    {type: "boolean", name: "disable_appeal_channel", description: "Set true to remove the quarantine appeal channel"},
  ]},
};

function buildData(name, spec) {
  const builder = new SlashCommandBuilder().setName(name).setDescription(spec.description).setDMPermission(false);
  for (const option of spec.options || []) {
    const method = `add${option.type[0].toUpperCase()}${option.type.slice(1)}Option`;
    builder[method](o => {
      o.setName(option.name).setDescription(option.description).setRequired(Boolean(option.required));
      if (option.max !== undefined && option.type === "string") o.setMaxLength(option.max);
      if (option.min !== undefined && option.type === "integer") o.setMinValue(option.min);
      if (option.max !== undefined && option.type === "integer") o.setMaxValue(option.max);
      if (option.channels) o.addChannelTypes(...TEXT_CHANNEL_TYPES);
      return o;
    });
  }
  return builder;
}

const reasonOf = i => i.options.getString("reason")?.trim() || "No reason provided";
async function reply(i, embed, ephemeral = true) {
  if (i.deferred) return i.editReply({embeds: [embed]});
  if (i.replied) return i.followUp({embeds: [embed], ephemeral});
  return i.reply({embeds: [embed], ephemeral});
}
const fail = (i, title, description) => reply(i, errorEmbed(title, description), true);
const isUsableTextChannel = ch => Boolean(ch?.isTextBased?.() && ch?.permissionOverwrites?.edit && !ch.isThread?.());
async function getTarget(i) {
  const user = i.options.getUser("member", true);
  const member = await i.guild.members.fetch(user.id).catch(() => null);
  return {user, member};
}
async function checkTarget(i, member) {
  const guild = i.guild;
  if (!member) return "That user is not currently a member of this server.";
  if (member.id === i.user.id) return "You cannot use this action on yourself.";
  if (member.id === i.client.user.id) return "I cannot use this action on myself.";
  if (member.id === guild.ownerId) return "The server owner is protected from this action.";
  const actor = await guild.members.fetch(i.user.id).catch(() => null);
  const bot = guild.members.me;
  if (!actor || !bot) return "I could not verify the required server roles. Please try again.";
  if (i.user.id !== guild.ownerId && actor.roles.highest.comparePositionTo(member.roles.highest) <= 0)
    return "Your highest role must be above the target member's highest role.";
  if (bot.roles.highest.comparePositionTo(member.roles.highest) <= 0)
    return "My highest role must be above the target member's highest role.";
  return null;
}
function actionFields(i, user, reason, extras = []) {
  return [
    {name: "Member", value: `${user} (\`${user.id}\`)`, inline: true},
    {name: "Moderator", value: `${i.user} (\`${i.user.id}\`)`, inline: true},
    {name: "Reason", value: String(reason || "No reason provided").slice(0, 1024), inline: false},
    ...extras,
  ];
}
async function sendActionLog(i, action, user, reason, extras = []) {
  const settings = await getModerationSettings(i.guild.id);
  if (!settings.logsChannelId) return {enabled: false, sent: false};
  const channel = await i.guild.channels.fetch(settings.logsChannelId).catch(() => null);
  const bot = i.guild.members.me;
  if (!isUsableTextChannel(channel) || !bot || !channel.permissionsFor(bot)?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks]))
    return {enabled: true, sent: false};
  const fields = [];
  if (user) fields.push({name: "Target", value: `${user} (\`${user.id}\`)`, inline: true});
  fields.push({name: "Moderator", value: `${i.user} (\`${i.user.id}\`)`, inline: true});
  fields.push({name: "Reason", value: String(reason || "No reason provided").slice(0, 1024), inline: false});
  fields.push(...extras);
  await channel.send({embeds: [brandEmbed(`Moderation • ${action}`, `A moderation action was completed in **${i.guild.name}**.`, {fields})]});
  return {enabled: true, sent: true};
}
async function completeAction(i, {action, title, description, user = null, reason, extras = []}) {
  let logState = {enabled: false, sent: false};
  try { logState = await sendActionLog(i, action, user, reason, extras); }
  catch (error) { console.error(`[moderation-log:${action}]`, error); logState = {enabled: true, sent: false}; }
  const fields = [...(user ? actionFields(i, user, reason, extras) : [
    {name: "Moderator", value: `${i.user} (\`${i.user.id}\`)`, inline: true},
    {name: "Reason", value: String(reason || "No reason provided").slice(0, 1024), inline: false},
    ...extras,
  ])];
  if (logState.enabled && !logState.sent) fields.push({name: "Action log", value: "The action succeeded, but the configured log channel could not be reached or written to. Check the channel and bot permissions.", inline: false});
  return reply(i, successEmbed(title, description, {fields}));
}
async function allChannels(guild) {
  const channels = await guild.channels.fetch();
  return [...channels.values()].filter(Boolean).filter(ch => ch.permissionOverwrites?.edit && !ch.isThread?.());
}
async function ensureQuarantineRole(guild, settings, actorTag) {
  let role = settings.quarantineRoleId ? await guild.roles.fetch(settings.quarantineRoleId).catch(() => null) : null;
  if (!role) role = guild.roles.cache.find(r => r.name.toLowerCase() === "origin labs quarantine" && !r.managed && r.permissions.bitfield === 0n) || null;
  if (!role) role = await guild.roles.create({name: "Origin Labs Quarantine", color: 0xF4B740, permissions: [], reason: `Quarantine role provisioned by ${actorTag}`});
  await updateModerationSettings(guild.id, {quarantineRoleId: role.id});
  return role;
}
async function applyQuarantineOverwrites(guild, role, appealChannelId, reason) {
  const channels = await allChannels(guild);
  const results = await Promise.allSettled(channels.map(channel => {
    const isAppeal = appealChannelId && channel.id === appealChannelId;
    const perms = isAppeal
      ? {ViewChannel: true, SendMessages: true, ReadMessageHistory: true, AddReactions: true}
      : {ViewChannel: false, SendMessages: false, SendMessagesInThreads: false, AddReactions: false, Connect: false, Speak: false, CreatePublicThreads: false, CreatePrivateThreads: false, UseApplicationCommands: false};
    return channel.permissionOverwrites.edit(role, perms, {reason});
  }));
  return {total: results.length, failed: results.filter(result => result.status === "rejected").length};
}
async function removeQuarantineOverwrites(guild, roleId) {
  const channels = await allChannels(guild);
  return Promise.allSettled(channels.map(channel => channel.permissionOverwrites.delete(roleId, "Quarantine release cleanup")));
}

const WARNING_MARKER = "origin-warning-record:";
const MAX_WARNING_SCAN_MESSAGES = 5000;

async function getWarningChannel(guild, settings) {
  if (!settings.warningChannelId) return null;
  return guild.channels.fetch(settings.warningChannelId).catch(() => null);
}

async function scanWarningMessages(channel, targetUserId = null, maxMessages = MAX_WARNING_SCAN_MESSAGES) {
  if (!channel?.messages?.fetch) return [];
  const found = [];
  let before;
  let scanned = 0;
  while (scanned < maxMessages) {
    const batch = await channel.messages.fetch({limit: Math.min(100, maxMessages - scanned), ...(before ? {before} : {})}).catch(error => {
      throw new Error(`Unable to read warning channel history. Check View Channel and Read Message History permissions. ${error?.message || ""}`);
    });
    if (!batch?.size) break;
    scanned += batch.size;
    for (const message of batch.values()) {
      if (message.author?.bot !== true) continue;
      const footer = message.embeds?.[0]?.footer?.text || "";
      if (!footer.startsWith(WARNING_MARKER)) continue;
      const targetId = footer.slice(WARNING_MARKER.length).trim();
      if (!targetUserId || targetId === targetUserId) found.push(message);
    }
    before = batch.last()?.id;
    if (batch.size < 100 || !before) break;
  }
  return found;
}

function parseWarningMessage(message) {
  const embed = message.embeds?.[0];
  const fields = embed?.fields || [];
  const field = name => fields.find(f => f.name === name)?.value || "Unknown";
  return {
    id: message.id,
    userId: (embed?.fields || []).find(f => f.name === "Member ID")?.value || "Unknown",
    reason: field("Reason"),
    moderatorId: field("Moderator ID"),
    createdAt: message.createdAt || new Date(),
  };
}

async function createWarningChannel(guild) {
  const botMember = guild.members.me;
  if (!botMember?.permissions.has([P.ManageChannels, P.ViewChannel, P.SendMessages, P.EmbedLinks, P.ReadMessageHistory, P.ManageMessages])) {
    throw new Error("The bot needs Manage Channels, View Channel, Send Messages, Embed Links, Read Message History, and Manage Messages to configure the warning channel.");
  }
  let channel = guild.channels.cache.find(ch => ch.name === "moderation-warnings" && ch.type === ChannelType.GuildText) || null;
  if (!channel) {
    channel = await guild.channels.create({name: "moderation-warnings", type: ChannelType.GuildText, topic: "Private warning history managed by the moderation bot. Do not use this as a general chat channel.", reason: "Moderation warning history setup"});
  }
  // Re-secure an existing same-named channel as well; never assume its overwrites are safe.
  await channel.permissionOverwrites.edit(guild.roles.everyone, {ViewChannel: false}, {reason: "Keep warning history private"});
  await channel.permissionOverwrites.edit(botMember, {ViewChannel: true, SendMessages: true, EmbedLinks: true, ReadMessageHistory: true, ManageMessages: true}, {reason: "Allow bot to manage warning history"});
  for (const role of guild.roles.cache.values()) {
    if (role.id === guild.roles.everyone.id || role.managed) continue;
    if (role.permissions.has([P.ModerateMembers]) || role.permissions.has([P.ManageGuild]) || role.permissions.has([P.Administrator])) {
      await channel.permissionOverwrites.edit(role, {ViewChannel: true, ReadMessageHistory: true}, {reason: "Allow moderators to review warning history"}).catch(() => {});
    }
  }
  return channel;
}

async function clearWarningChannelRecords(guild, settings, targetUserId = null) {
  const channel = await getWarningChannel(guild, settings);
  if (!channel) return 0;
  // Clearing warning records must cover all channel history so logs-off never leaves older records behind.
  const messages = await scanWarningMessages(channel, targetUserId, Number.MAX_SAFE_INTEGER);
  let deleted = 0;
  for (const message of messages) {
    await message.delete().then(() => deleted++).catch(() => {});
  }
  return deleted;
}

function warningRecordEmbed(i, user, reason) {
  return brandEmbed("⚠️ Moderation warning", `${user} has received a warning in **${i.guild.name}**.`, {fields: [
    {name: "Member", value: `${user}`, inline: true},
    {name: "Member ID", value: user.id, inline: true},
    {name: "Moderator", value: `${i.user}`, inline: true},
    {name: "Moderator ID", value: i.user.id, inline: true},
    {name: "Reason", value: String(reason || "No reason provided").slice(0, 1024), inline: false},
  ], footer: `${WARNING_MARKER}${user.id}`});
}

function directMessageEmbed(guild, moderator, action, reason) {
  const verb = action === "ban" ? "banned" : action === "kick" ? "kicked" : "soft-banned";
  return warningEmbed(`Moderation notice: ${action}`, `A moderator has ${verb} you from **${guild.name}**.`, {
    thumbnail: guild.iconURL({size: 256}) || undefined,
    fields: [
      {name: "Server", value: guild.name.slice(0, 1024), inline: true},
      {name: "Moderator", value: String(moderator.tag || moderator.username).slice(0, 1024), inline: true},
      {name: "Reason", value: String(reason || "No reason provided").slice(0, 1024), inline: false},
      {name: "Note", value: "This message is sent automatically. If you believe this was a mistake, use the server's official appeal route if one is available.", inline: false},
    ], footer: "Automated moderation notice",
  });
}

async function tryActionDM(user, guild, moderator, action, reason) {
  try {
    await user.send({embeds: [directMessageEmbed(guild, moderator, action, reason)], allowedMentions: {parse: []}});
    return true;
  } catch {
    return false;
  }
}

async function run(i, name) {
  const spec = specs[name];
  const guild = i.guild;
  if (!guild) return fail(i, "Server only", "This moderation command can only be used inside a server.");
  if (!i.memberPermissions?.has(spec.permission))
    return fail(i, "Permission required", `You need **${Object.entries(P).find(([, value]) => value === spec.permission)?.[0]?.replace(/([A-Z])/g, " $1") || "the required"}** permission to use this command.`);
  const bot = guild.members.me;
  if (spec.botPermission && !bot?.permissions.has(spec.botPermission))
    return fail(i, "Missing bot permission", "Grant me the required server permission and make sure my highest role is positioned correctly.");
  const reason = reasonOf(i);

  if (name === "modconfig") {
    const logsChannel = i.options.getChannel("logs_channel");
    const disableLogs = i.options.getBoolean("disable_logs");
    const setupWarningChannel = i.options.getBoolean("setup_warning_channel");
    const appealChannel = i.options.getChannel("appeal_channel");
    const disableAppeal = i.options.getBoolean("disable_appeal_channel");
    if (logsChannel && disableLogs === true) return fail(i, "Conflicting options", "Choose a log channel or disable logging, not both in the same command.");
    if (appealChannel && disableAppeal === true) return fail(i, "Conflicting options", "Choose an appeal channel or disable it, not both in the same command.");
    if (logsChannel && !isUsableTextChannel(logsChannel)) return fail(i, "Invalid log channel", "Choose a standard text or announcement channel.");
    if (appealChannel && !isUsableTextChannel(appealChannel)) return fail(i, "Invalid appeal channel", "Choose a standard text or announcement channel.");
    const patch = {};
    if (logsChannel) patch.logsChannelId = logsChannel.id;
    if (appealChannel) patch.quarantineAppealChannelId = appealChannel.id;
    if (disableAppeal === true) patch.quarantineAppealChannelId = null;
    if (setupWarningChannel === true) {
      const settingsNow = await getModerationSettings(guild.id);
      let warningChannel = await getWarningChannel(guild, settingsNow);
      if (!warningChannel) warningChannel = await createWarningChannel(guild);
      patch.warningChannelId = warningChannel.id;
    }
    let clearedWarningCount = null;
    if (disableLogs === true) {
      const settingsNow = await getModerationSettings(guild.id);
      // Warning history is channel-based, never database-backed; erase it before switching logs off.
      try {
        clearedWarningCount = await clearWarningChannelRecords(guild, settingsNow);
      } catch (error) {
        console.error("[moderation:warnings:clear-on-disable]", error);
        return fail(i, "Could not disable logs safely", "I could not verify or clear the warning history. Logs remain enabled; check the bot's View Channel, Read Message History, and Manage Messages permissions in the warning channel, then retry.");
      }
      patch.logsChannelId = null;
    }
    const settings = Object.keys(patch).length ? await updateModerationSettings(guild.id, patch) : await getModerationSettings(guild.id);
    const role = settings.quarantineRoleId ? guild.roles.cache.get(settings.quarantineRoleId) : null;
    const appeal = settings.quarantineAppealChannelId ? guild.channels.cache.get(settings.quarantineAppealChannelId) : null;
    const warningChannel = settings.warningChannelId ? guild.channels.cache.get(settings.warningChannelId) : null;
    const fields = [
      {name: "Moderation logs", value: settings.logsChannelId ? `<#${settings.logsChannelId}>` : "Disabled", inline: true},
      {name: "Warning history channel", value: warningChannel ? `<#${warningChannel.id}>` : "Not set up — use `setup_warning_channel:true`", inline: true},
      {name: "DM notices", value: "Always attempted before ban, kick, and softban. If delivery fails, the moderation action still proceeds.", inline: false},
      {name: "Quarantine role", value: role ? `<@&${role.id}>` : "A dedicated no-permission role is created on first use", inline: true},
      {name: "Appeal channel", value: appeal ? `<#${appeal.id}>` : "Not configured", inline: true},
      {name: "Warning storage", value: "Warning records are Discord channel messages only; they are not written to a MongoDB warnings collection. Disabling logs clears recorded warnings.", inline: false},
      ...(clearedWarningCount !== null ? [{name: "Warning cleanup", value: `Deleted ${clearedWarningCount} warning record(s) before disabling logs.`, inline: false}] : []),
      {name: "Action history", value: "Successful action logs are sent only to the configured moderation log channel.", inline: false},
    ];
    return reply(i, brandEmbed(Object.keys(patch).length ? "Moderation settings updated" : "Moderation settings", `Settings for **${guild.name}**.`, {fields}));
  }

  if (name === "unban") {
    const id = i.options.getString("user_id", true).trim();
    if (!/^\d{17,20}$/.test(id)) return fail(i, "Invalid user ID", "Enter the numeric Discord user ID of the banned user.");
    if (!bot?.permissions.has(P.BanMembers)) return fail(i, "Missing bot permission", "I need **Ban Members** permission.");
    const result = await guild.bans.remove(id, `Requested by ${i.user.tag}: ${reason}`.slice(0, 512)).catch(() => null);
    if (!result) return fail(i, "Unban failed", "That user may not be banned, or Discord rejected the action.");
    return completeAction(i, {action: "Unban", title: "Member unbanned", description: `<@${id}> has been unbanned from **${guild.name}**.`, reason, extras: [{name: "User ID", value: `\`${id}\``, inline: true}]});
  }

  if (name === "warnings") {
    const user = i.options.getUser("member", true);
    const settings = await getModerationSettings(guild.id);
    if (!settings.logsChannelId) return reply(i, infoEmbed("Warning history disabled", "Moderation logs are disabled, so warnings are not retained. Re-enable logs and configure a warning channel to keep warning history."));
    const channel = await getWarningChannel(guild, settings);
    if (!channel) return reply(i, infoEmbed("Warning channel not configured", "A server manager must run `/modconfig setup_warning_channel:true` before warning history can be recorded."));
    const messages = await scanWarningMessages(channel, user.id);
    const warnings = messages.map(parseWarningMessage).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    if (!warnings.length) return reply(i, infoEmbed("No warnings", `${user} has no recorded warnings.`));
    const latest = warnings.slice(-10).reverse().map((warning, index) =>
      `**${warnings.length - index}.** ${String(warning.reason || "No reason provided").slice(0, 220)}\n*Moderator:* <@${warning.moderatorId || "0"}> • <t:${Math.floor(new Date(warning.createdAt || Date.now()).getTime() / 1000)}:R>`,
    ).join("\n\n");
    return reply(i, brandEmbed("Member warnings", `Recorded warnings for ${user}.\n\n${latest.slice(0, 3900)}`, {fields: [
      {name: "Total warnings", value: `\`${warnings.length}\``, inline: true},
      {name: "Showing", value: `Latest ${Math.min(10, warnings.length)}`, inline: true},
      {name: "Source", value: `Channel history in <#${channel.id}>`, inline: false},
    ]}));
  }

  if (name === "clearwarnings") {
    const user = i.options.getUser("member", true);
    const settings = await getModerationSettings(guild.id);
    const count = await clearWarningChannelRecords(guild, settings, user.id).catch(error => { throw error; });
    return completeAction(i, {action: "Clear warnings", title: "Warnings cleared", description: `Deleted ${count} recorded warning(s) for ${user} from the warning channel.`, user, reason, extras: [{name: "Warnings cleared", value: String(count), inline: true}]});
  }

  if (name === "purge") {
    const amount = i.options.getInteger("amount", true);
    const channel = i.options.getChannel("channel") || i.channel;
    if (!isUsableTextChannel(channel)) return fail(i, "Invalid channel", "Choose a standard text or announcement channel.");
    if (!channel.permissionsFor(bot)?.has([P.ViewChannel, P.ReadMessageHistory, P.ManageMessages])) return fail(i, "Missing bot permission", "I need **View Channel**, **Read Message History**, and **Manage Messages** in that channel.");
    if (!channel.permissionsFor(await guild.members.fetch(i.user.id))?.has([P.ViewChannel, P.ReadMessageHistory, P.ManageMessages])) return fail(i, "Missing permission", "You need **View Channel**, **Read Message History**, and **Manage Messages** in the selected channel.");
    const deleted = await channel.bulkDelete(amount, true);
    return completeAction(i, {action: "Purge", title: "Messages cleaned", description: `Deleted **${deleted.size}** recent messages from ${channel}. Messages older than 14 days cannot be bulk-deleted.`, reason, extras: [
      {name: "Requested", value: String(amount), inline: true}, {name: "Deleted", value: String(deleted.size), inline: true}, {name: "Channel", value: `${channel}`, inline: true},
    ]});
  }

  if (name === "slowmode" || name === "lock" || name === "unlock") {
    const channel = i.options.getChannel("channel") || i.channel;
    if (!isUsableTextChannel(channel)) return fail(i, "Invalid channel", "Choose a standard text or announcement channel.");
    const required = name === "slowmode" ? [P.ManageChannels, P.ViewChannel] : [P.ManageChannels, P.ViewChannel];
    if (!channel.permissionsFor(bot)?.has(required)) return fail(i, "Missing bot permission", "I need **Manage Channels** and **View Channel** in that channel.");
    const actor = await guild.members.fetch(i.user.id).catch(() => null);
    if (!actor || !channel.permissionsFor(actor)?.has(required)) return fail(i, "Missing permission", "You need **Manage Channels** and **View Channel** in the selected channel.");
    if (name === "slowmode") {
      const seconds = i.options.getInteger("seconds", true);
      await channel.setRateLimitPerUser(seconds, `Set by ${i.user.tag}: ${reason}`.slice(0, 512));
      return completeAction(i, {action: "Slowmode", title: "Slowmode updated", description: seconds ? `Slowmode in ${channel} is now **${seconds} seconds**.` : `Slowmode has been disabled in ${channel}.`, reason, extras: [{name: "Delay", value: `${seconds} seconds`, inline: true}, {name: "Channel", value: `${channel}`, inline: true}]});
    }
    const locked = name === "lock";
    await channel.permissionOverwrites.edit(guild.roles.everyone, {
      SendMessages: locked ? false : null,
      SendMessagesInThreads: locked ? false : null,
      CreatePublicThreads: locked ? false : null,
      CreatePrivateThreads: locked ? false : null,
    }, {reason: `${locked ? "Locked" : "Unlocked"} by ${i.user.tag}: ${reason}`.slice(0, 512)});
    return completeAction(i, {action: locked ? "Lock channel" : "Unlock channel", title: locked ? "Channel locked" : "Channel unlocked", description: `${channel} has been ${locked ? "locked" : "unlocked"} for @everyone.`, reason, extras: [{name: "Channel", value: `${channel}`, inline: true}]});
  }

  const {user, member} = await getTarget(i);
  const problem = await checkTarget(i, member);
  if (problem) return fail(i, "Action blocked", problem);

  if (name === "ban") {
    if (!member.bannable) return fail(i, "Cannot ban this member", "My highest role must be above the target's highest role, and I need **Ban Members** permission.");
    await i.deferReply({ephemeral: true});
    const dmSent = await tryActionDM(user, guild, i.user, "ban", reason);
    const days = i.options.getInteger("delete_message_days") ?? 0;
    const result = await guild.members.ban(user.id, {reason: `Requested by ${i.user.tag} (${i.user.id}): ${reason}`.slice(0, 512), deleteMessageSeconds: days * 86400}).catch(() => null);
    if (!result) {
      if (dmSent) await user.send({embeds: [warningEmbed("Ban not completed", `The ban request in **${guild.name}** could not be completed. No ban was applied.`, {footer: "Automated moderation update"})], allowedMentions: {parse: []}}).catch(() => {});
      return fail(i, "Ban failed", "Discord rejected the ban. Check my permissions and role hierarchy. DM delivery status does not affect whether the ban is attempted.");
    }
    return completeAction(i, {action: "Ban", title: "Member banned", description: `${user} has been banned from **${guild.name}**.`, user, reason, extras: [
      {name: "DM status", value: dmSent ? "Delivered before action" : "Delivery failed; ban still executed", inline: true},
      {name: "Message history deleted", value: `${days} day(s)`, inline: true},
    ]});
  }

  if (name === "kick") {
    if (!member.kickable) return fail(i, "Cannot kick member", "My highest role must be above the target's highest role, and I need **Kick Members** permission.");
    await i.deferReply({ephemeral: true});
    const dmSent = await tryActionDM(user, guild, i.user, "kick", reason);
    const kicked = await member.kick(`Requested by ${i.user.tag} (${i.user.id}): ${reason}`.slice(0, 512)).catch(() => null);
    if (!kicked) {
      if (dmSent) await user.send({embeds: [warningEmbed("Kick not completed", `The kick request in **${guild.name}** could not be completed by Discord. No removal occurred.`, {footer: "Automated moderation update"})], allowedMentions: {parse: []}}).catch(() => {});
      return fail(i, "Kick failed", "Discord rejected the kick. The member was not removed. Check my permissions and role hierarchy.");
    }
    return completeAction(i, {action: "Kick", title: "Member kicked", description: `${user} has been kicked from **${guild.name}**.`, user, reason, extras: [{name: "DM status", value: dmSent ? "Delivered before action" : "Delivery failed; kick still executed", inline: true}]});
  }

  if (name === "timeout" || name === "untimeout") {
    if (!member.moderatable) return fail(i, "Cannot manage timeout", "I need **Moderate Members**, and my highest role must be above the target's highest role.");
    if (name === "timeout") {
      const minutes = i.options.getInteger("duration_minutes", true);
      await member.timeout(minutes * 60_000, `Requested by ${i.user.tag}: ${reason}`.slice(0, 512));
      return completeAction(i, {action: "Timeout", title: "Timeout applied", description: `${user} has been timed out.`, user, reason, extras: [{name: "Duration", value: `${minutes} minute(s)`, inline: true}]});
    }
    await member.timeout(null, `Requested by ${i.user.tag}: ${reason}`.slice(0, 512));
    return completeAction(i, {action: "Remove timeout", title: "Timeout removed", description: `${user}'s timeout has been removed.`, user, reason});
  }

  if (name === "warn") {
    const settings = await getModerationSettings(guild.id);
    const warningChannel = await getWarningChannel(guild, settings);
    let recorded = false;
    if (settings.logsChannelId && warningChannel) {
      const botMember = guild.members.me;
      if (!warningChannel.permissionsFor(botMember)?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks, P.ReadMessageHistory, P.ManageMessages])) {
        return fail(i, "Warning channel permissions missing", "I need View Channel, Send Messages, Embed Links, Read Message History, and Manage Messages in the warning channel. No warning record was saved.");
      }
      await warningChannel.send({embeds: [warningRecordEmbed(i, user, reason)], allowedMentions: {parse: []}});
      recorded = true;
    }
    const dmSent = await user.send({embeds: [warningEmbed("You received a moderation warning", `A moderator in **${guild.name}** issued a warning.\n\n**Reason:** ${reason}`, {thumbnail: guild.iconURL({size: 256}) || undefined, footer: "Automated moderation notice"})], allowedMentions: {parse: []}}).then(() => true).catch(() => false);
    const description = recorded
      ? `${user} has received a warning, and its record was posted in <#${warningChannel.id}>.`
      : `${user} has received a warning notice attempt, but no persistent warning record was kept because moderation logs are disabled or the warning channel is not configured.`;
    return completeAction(i, {action: "Warn", title: recorded ? "Warning recorded" : "Warning issued without history", description, user, reason, extras: [
      {name: "Warning record", value: recorded ? "Saved in the Discord warning channel" : "Not retained", inline: true},
      {name: "Member DM", value: dmSent ? "Delivered" : "Could not be delivered", inline: true},
    ]});
  }

  if (name === "softban") {
    if (!member.bannable) return fail(i, "Cannot softban member", "My highest role must be above the target's highest role, and I need **Ban Members** permission.");
    await i.deferReply({ephemeral: true});
    const dmSent = await tryActionDM(user, guild, i.user, "softban", reason);
    const days = i.options.getInteger("delete_message_days") ?? 0;
    await guild.members.ban(user.id, {reason: `Softban by ${i.user.tag}: ${reason}`.slice(0, 512), deleteMessageSeconds: days * 86400});
    try {
      await guild.members.unban(user.id, `Softban completed by ${i.user.tag}: ${reason}`.slice(0, 512));
    } catch (error) {
      console.error("[moderation:softban] Ban succeeded but automatic unban failed:", error);
      try { await sendActionLog(i, "Softban (partial failure)", user, reason, [{name: "Status", value: "Ban succeeded; automatic unban failed. Manual unban may be required.", inline: false}]); } catch {}
      return reply(i, warningEmbed("Softban partially completed", `${user} was banned and the recent-message deletion was applied, but automatic unban failed. The member may still be banned; use `/unban` with their user ID to release them.`, {fields: actionFields(i, user, reason, [{name: "Message history deleted", value: `${days} day(s)`, inline: true}, {name: "DM status", value: dmSent ? "Delivered before action" : "Delivery failed; action still executed", inline: true}])}));
    }
    return completeAction(i, {action: "Softban", title: "Softban completed", description: `${user} was banned and immediately unbanned.`, user, reason, extras: [
      {name: "DM status", value: dmSent ? "Delivered before action" : "Delivery failed; action still executed", inline: true},
      {name: "Message history deleted", value: `${days} day(s)`, inline: true},
    ]});
  }

  if (name === "nick") {
    const nickname = i.options.getString("nickname")?.trim() || null;
    if (!member.manageable) return fail(i, "Cannot manage nickname", "My highest role must be above the target member's highest role.");
    await member.setNickname(nickname, `Requested by ${i.user.tag}: ${reason}`.slice(0, 512));
    return completeAction(i, {action: "Nickname", title: "Nickname updated", description: nickname ? `${user}'s nickname is now **${nickname}**.` : `${user}'s nickname has been reset.`, user, reason, extras: [{name: "Nickname", value: nickname || "Reset to username", inline: true}]});
  }

  if (name === "quarantine") {
    await i.deferReply({ephemeral: true});
    const settings = await getModerationSettings(guild.id);
    const role = await ensureQuarantineRole(guild, settings, i.user.tag);
    if (bot.roles.highest.comparePositionTo(role) <= 0) return reply(i, errorEmbed("Role hierarchy", "Move my highest role above the quarantine role, then try again."));
    if (member.roles.cache.has(role.id)) return reply(i, infoEmbed("Already quarantined", `${user} already has the quarantine role.`));
    const roleIds = member.roles.cache.filter(r => r.id !== guild.id && !r.managed && r.id !== role.id).map(r => r.id);
    // Save operational restore state before modifying roles. No action-history document is created.
    await saveQuarantine(guild.id, user.id, {roleIds, quarantineRoleId: role.id, moderatorId: i.user.id, reason, createdAt: new Date()});
    const overwrites = await applyQuarantineOverwrites(guild, role, settings.quarantineAppealChannelId, `Quarantine policy applied by ${i.user.tag}`);
    await member.roles.set([role], `Quarantined by ${i.user.tag}: ${reason}`.slice(0, 512));
    return completeAction(i, {action: "Quarantine", title: "Member quarantined", description: `${user} has been isolated. Their previous assignable roles have been saved for restoration.`, user, reason, extras: [
      {name: "Channels processed", value: `${overwrites.total - overwrites.failed}/${overwrites.total}`, inline: true},
      {name: "Permission update failures", value: String(overwrites.failed), inline: true},
      {name: "Appeal channel", value: settings.quarantineAppealChannelId ? `<#${settings.quarantineAppealChannelId}>` : "None configured", inline: true},
    ]});
  }

  if (name === "unquarantine") {
    await i.deferReply({ephemeral: true});
    const record = await getQuarantine(guild.id, user.id);
    if (!record) return reply(i, errorEmbed("No saved quarantine record", `No role backup was found for ${user}. I have not changed their roles.`));
    const role = guild.roles.cache.get(record.quarantineRoleId) || await guild.roles.fetch(record.quarantineRoleId).catch(() => null);
    if (role) await removeQuarantineOverwrites(guild, role.id);
    const restore = (record.roleIds || []).map(id => guild.roles.cache.get(id)).filter(r => r && !r.managed && bot.roles.highest.comparePositionTo(r) > 0);
    await member.roles.set(restore, `Quarantine removed by ${i.user.tag}: ${reason}`.slice(0, 512));
    if (role && member.roles.cache.has(role.id)) await member.roles.remove(role, `Quarantine removed by ${i.user.tag}`).catch(() => {});
    await deleteQuarantine(guild.id, user.id);
    return completeAction(i, {action: "Unquarantine", title: "Member released", description: `${user} has been released from quarantine.`, user, reason, extras: [{name: "Restored roles", value: String(restore.length), inline: true}]});
  }
}

export function createModerationCommand(name) {
  const spec = specs[name];
  if (!spec) throw new Error(`Unknown moderation command: ${name}`);
  return {
    name,
    data: buildData(name, spec),
    async execute({interaction}) {
      try { return await run(interaction, name); }
      catch (error) {
        console.error(`[moderation:${name}]`, error);
        const message = error?.code === 50013
          ? "Discord denied this action. Check channel/role permissions and bot role hierarchy."
          : "The command could not be completed. No success was reported. Check permissions and try again.";
        return reply(interaction, errorEmbed(`${name} failed`, message), true).catch(() => {});
      }
    },
  };
}
