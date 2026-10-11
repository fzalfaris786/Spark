import {createModuleCommand, fail, infoEmbed, safeReply} from "../commandFactory.js";
import {getAutoroleConfig} from "./services/index.js";

function chunkLines(lines, maxLength = 3500) {
  const chunks = []; let current = "";
  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length > maxLength && current) { chunks.push(current); current = line; } else current = next;
  }
  if (current) chunks.push(current);
  return chunks;
}

export default createModuleCommand("reactionrole-list", "List all configured reaction-role mappings.", [], async interaction => {
  if (!interaction.guild) return fail(interaction, "Server only", "Run this command in a server.");
  const config = await getAutoroleConfig(interaction.guild.id);
  const lines = (config.reactionRoles || []).map((mapping, index) => `${index + 1}. ${mapping.emojiInput} → <@&${mapping.roleId}> in <#${mapping.channelId}> (message \`${mapping.messageId}\`)`);
  if (!lines.length) return safeReply(interaction, {embeds: [infoEmbed("Reaction roles", "No reaction roles are configured.")]});
  const embeds = chunkLines(lines).map((description, index) => infoEmbed(index ? `Reaction roles • Continued (${index + 1})` : "Reaction roles", description));
  return safeReply(interaction, {embeds});
});
