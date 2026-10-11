import {createModuleCommand, managerOnly, denyPermission, ok, fail} from "../commandFactory.js";
import {saveConfig} from "../shared.js";

export default createModuleCommand("goodbye-disable", "Disable goodbye messages.", [], async interaction => {
  if (!interaction.guild) return fail(interaction, "Server only", "Run this command in a server.");
  if (!managerOnly(interaction)) return denyPermission(interaction);
  await saveConfig("goodbye", interaction.guild.id, {enabled: false});
  return ok(interaction, "Goodbye disabled", "No new messages will be sent until re-enabled.");
});
