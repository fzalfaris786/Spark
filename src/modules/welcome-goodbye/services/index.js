import {getConfig, replaceTemplate, moduleEmbed} from "../../shared.js";
import {PermissionFlagsBits as P} from "discord.js";

export const WELCOME_DEFAULTS = Object.freeze({
  enabled: false,
  channelId: null,
  message: "Welcome {user} to **{server}**! You are member **#{memberCount}**.",
  bannerUrl: null,
  dmEnabled: false,
  showAvatar: true,
  color: "3B82F6",
});
export const GOODBYE_DEFAULTS = Object.freeze({
  enabled: false,
  channelId: null,
  message: "**{username}** has left **{server}**. We now have **{memberCount}** members.",
  bannerUrl: null,
  showAvatar: true,
  color: "64748B",
});

export async function getWelcomeConfig(guildId) {
  return {...WELCOME_DEFAULTS, ...(await getConfig("welcome", guildId))};
}
export async function getGoodbyeConfig(guildId) {
  return {...GOODBYE_DEFAULTS, ...(await getConfig("goodbye", guildId))};
}
export const isText = channel => Boolean(channel?.isTextBased?.() && channel.guildId);

export function imageUrl(value) {
  if (!value) return null;
  try {
    const validationValue = String(value).replace(/\{(?:username|user|server|memberCount|userId|createdAt|avatar)\}/g, "placeholder");
    const url = new URL(validationValue);
    return ["https:", "http:"].includes(url.protocol) ? String(value) : null;
  } catch {
    return null;
  }
}

function expandBannerUrl(template, member, guild) {
  if (!template) return null;
  const user = member.user || member;
  const values = {
    username: user.username || user.tag || "member",
    user: user.username || user.tag || "member",
    server: guild.name || "server",
    memberCount: String(guild.memberCount ?? "?"),
    userId: user.id,
    createdAt: String(Math.floor((user.createdTimestamp || Date.now()) / 1000)),
    avatar: user.displayAvatarURL?.({extension: "png", size: 512}) || "",
  };
  let result = String(template);
  for (const [key, value] of Object.entries(values)) result = result.replaceAll(`{${key}}`, encodeURIComponent(value));
  return imageUrl(result);
}

export function buildMemberEmbed(kind, member, config, preview = false) {
  const user = member.user || member;
  const guild = member.guild;
  const defaults = kind === "welcome" ? WELCOME_DEFAULTS : GOODBYE_DEFAULTS;
  const title = kind === "welcome" ? `Welcome to ${guild.name}` : `Member left ${guild.name}`;
  const description = replaceTemplate(config.message || defaults.message, member, guild);
  const embed = moduleEmbed(title, description);
  const color = Number.parseInt(String(config.color || defaults.color).replace(/^#/, ""), 16);
  if (Number.isInteger(color) && color >= 0 && color <= 0xFFFFFF) embed.setColor(color);
  if (config.showAvatar && user.displayAvatarURL) embed.setThumbnail(user.displayAvatarURL({size: 256}));
  const image = expandBannerUrl(config.bannerUrl, member, guild);
  if (image) embed.setImage(image);
  embed.addFields(
    {name: "Member", value: `${user} · \`${user.id}\``, inline: true},
    {name: "Members", value: String(guild.memberCount ?? "?"), inline: true},
  );
  if (preview) embed.setFooter({text: "Preview • The Origin Labs"});
  return embed;
}

export async function handleMemberWelcome(member) {
  if (!member.guild || member.user.bot) return;
  const config = await getWelcomeConfig(member.guild.id);
  if (!config.enabled || !config.channelId) return;
  const channel = await member.guild.channels.fetch(config.channelId).catch(() => null);
  const bot = member.guild.members.me;
  if (!isText(channel) || !bot || !channel.permissionsFor(bot)?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks])) {
    console.warn(`[welcome] Cannot send welcome in configured channel for guild ${member.guild.id}`);
    return;
  }
  await channel.send({embeds: [buildMemberEmbed("welcome", member, config)], allowedMentions: {users: [member.id], roles: [], parse: []}})
    .catch(error => console.error("[welcome:send]", error.message));
  if (config.dmEnabled) {
    await member.send({embeds: [buildMemberEmbed("welcome", member, {...config, bannerUrl: null})]})
      .catch(() => {});
  }
}

export async function handleMemberGoodbye(member) {
  if (!member.guild || member.user.bot) return;
  const config = await getGoodbyeConfig(member.guild.id);
  if (!config.enabled || !config.channelId) return;
  const channel = await member.guild.channels.fetch(config.channelId).catch(() => null);
  const bot = member.guild.members.me;
  if (!isText(channel) || !bot || !channel.permissionsFor(bot)?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks])) {
    console.warn(`[goodbye] Cannot send goodbye in configured channel for guild ${member.guild.id}`);
    return;
  }
  await channel.send({embeds: [buildMemberEmbed("goodbye", member, config)], allowedMentions: {parse: []}})
    .catch(error => console.error("[goodbye:send]", error.message));
}
