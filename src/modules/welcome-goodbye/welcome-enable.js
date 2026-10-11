import {createModuleCommand, managerOnly, denyPermission, ok, fail} from "../commandFactory.js";
import {saveConfig} from "../shared.js";
import {getWelcomeConfig} from "./services/index.js";

export default createModuleCommand("welcome-enable", "Enable welcome messages.", [], async interaction => {
  if (!interaction.guild) return fail(interaction, "Server only", "Run this command in a server.");
  if (!managerOnly(interaction)) return denyPermission(interaction);
  const config = await getWelcomeConfig(interaction.guild.id);
  if (!config.channelId) return fail(interaction, "Channel not configured", "Run /welcome-setup first.");
  await saveConfig("welcome", interaction.guild.id, {enabled: true});
  return ok(interaction, "Welcome enabled", "The event handler is now active.");
});
