import {createModuleCommand, fail, infoEmbed, safeReply} from "../commandFactory.js";
import {getAutomodConfig} from "./services/index.js";

function chunkLines(lines, maxLength = 3500) {
  const chunks = [];
  let current = "";
  for (const line of lines) {
    const next = current ? `${current}\n${line}` : line;
    if (next.length > maxLength && current) { chunks.push(current); current = line; }
    else current = next;
  }
  if (current) chunks.push(current);
  return chunks;
}

export default createModuleCommand("automod-word-list", "List the current blocked words and phrases.", [], async interaction => {
  if (!interaction.guild) return fail(interaction, "Server only", "Run this command in a server.");
  const config = await getAutomodConfig(interaction.guild.id);
  if (!config.blockedWords.length) return safeReply(interaction, {embeds: [infoEmbed("Blocked words", "No words are configured.")]});
  const lines = config.blockedWords.map((word, index) => `${index + 1}. ${word}`);
  const pages = chunkLines(lines).map((description, index) => infoEmbed(index ? `Blocked words • Continued (${index + 1})` : "Blocked words", description));
  return safeReply(interaction, {embeds: pages});
});
