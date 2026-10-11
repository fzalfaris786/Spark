import {EmbedBuilder} from "discord.js";

// Shared visual system: keep all bot embeds consistent and polished.
export const COLORS = Object.freeze({
  brand: 0x7C5CFC,
  success: 0x35C98A,
  error: 0xF05D6C,
  warning: 0xF4B740,
  info: 0x48A9E6,
  neutral: 0x667085,
});

const DEFAULT_FOOTER = "The Origin Labs • Built with care";

export function createEmbed({
  title,
  description,
  color = COLORS.brand,
  fields,
  thumbnail,
  image,
  author,
  footer = DEFAULT_FOOTER,
  timestamp = true,
  url,
} = {}) {
  const embed = new EmbedBuilder().setColor(color);
  if (title) embed.setTitle(title);
  if (description) embed.setDescription(description);
  if (fields?.length) embed.addFields(fields);
  if (thumbnail) embed.setThumbnail(thumbnail);
  if (image) embed.setImage(image);
  if (author) embed.setAuthor(author);
  if (url) embed.setURL(url);
  if (footer) embed.setFooter({text: footer});
  if (timestamp) embed.setTimestamp();
  return embed;
}

export const successEmbed = (title, description, options = {}) =>
  createEmbed({title: `✅ ${title}`, description, color: COLORS.success, ...options});
export const errorEmbed = (title, description, options = {}) =>
  createEmbed({title: `⚠️ ${title}`, description, color: COLORS.error, ...options});
export const warningEmbed = (title, description, options = {}) =>
  createEmbed({title: `⚠ ${title}`, description, color: COLORS.warning, ...options});
export const infoEmbed = (title, description, options = {}) =>
  createEmbed({title: `✦ ${title}`, description, color: COLORS.info, ...options});
export const brandEmbed = (title, description, options = {}) =>
  createEmbed({title, description, color: COLORS.brand, ...options});
