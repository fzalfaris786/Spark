import {createModuleCommand, managerOnly, denyPermission, ok, fail} from "../commandFactory.js";
import {saveConfig, cleanText} from "../shared.js";

export default createModuleCommand("welcome-message", "Set the welcome embed message template.", [
  {type: "string", name: "template", description: "Text; placeholders: {user}, {username}, {server}, {memberCount}, {userId}, {createdAt}", required: true, minLength: 1, maxLength: 1800},
], async interaction => {
  if (!interaction.guild) return fail(interaction, "Server only", "Run this command in a server.");
  if (!managerOnly(interaction)) return denyPermission(interaction);
  const template = cleanText(interaction.options.getString("template", true), 1800);
  await saveConfig("welcome", interaction.guild.id, {message: template});
  return ok(interaction, "Welcome message saved", `New template:\n${template}`);
});
