import {createModuleCommand, managerOnly, denyPermission, ok, fail} from "../commandFactory.js";
import {saveConfig} from "../shared.js";
import {getGoodbyeConfig} from "./services/index.js";

export default createModuleCommand("goodbye-enable", "Enable goodbye messages.", [], async interaction => {
  if (!interaction.guild) return fail(interaction, "Server only", "Run this command in a server.");
  if (!managerOnly(interaction)) return denyPermission(interaction);
  const config = await getGoodbyeConfig(interaction.guild.id);
  if (!config.channelId) return fail(interaction, "Channel not configured", "Run /goodbye-setup first.");
  await saveConfig("goodbye", interaction.guild.id, {enabled: true});
  return ok(interaction, "Goodbye enabled", "The event handler is now active.");
});
