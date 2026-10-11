import {createModuleCommand, managerOnly, denyPermission, fail, safeReply} from "../commandFactory.js";
import {getGoodbyeConfig, buildMemberEmbed} from "./services/index.js";

export default createModuleCommand("goodbye-test", "Preview the goodbye embed privately.", [], async interaction => {
  if (!interaction.guild) return fail(interaction, "Server only", "Run this command in a server.");
  if (!managerOnly(interaction)) return denyPermission(interaction);
  const config = await getGoodbyeConfig(interaction.guild.id);
  const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
  if (!member) return fail(interaction, "Member unavailable", "I could not fetch your server member profile.");
  return safeReply(interaction, {embeds: [buildMemberEmbed("goodbye", member, config, true)]});
});
