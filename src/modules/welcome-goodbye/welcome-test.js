import {createModuleCommand, managerOnly, denyPermission, fail, safeReply} from "../commandFactory.js";
import {getWelcomeConfig, buildMemberEmbed} from "./services/index.js";

export default createModuleCommand("welcome-test", "Preview the welcome embed privately.", [], async interaction => {
  if (!interaction.guild) return fail(interaction, "Server only", "Run this command in a server.");
  if (!managerOnly(interaction)) return denyPermission(interaction);
  const config = await getWelcomeConfig(interaction.guild.id);
  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) return fail(interaction, "Member unavailable", "I could not fetch your server member profile.");
  return safeReply(interaction, {embeds: [buildMemberEmbed("welcome", member, config, true)]});
});
