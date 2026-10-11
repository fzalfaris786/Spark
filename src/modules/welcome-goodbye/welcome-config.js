import {createModuleCommand, managerOnly, denyPermission, ok, fail, safeReply, infoEmbed} from "../commandFactory.js";
import {saveConfig} from "../shared.js";
import {getWelcomeConfig, imageUrl} from "./services/index.js";

export default createModuleCommand("welcome-config", "Adjust optional welcome message settings.", [
  {type: "boolean", name: "dm_enabled", description: "Also attempt to DM new members"},
  {type: "boolean", name: "show_avatar", description: "Show member avatar thumbnail"},
  {type: "string", name: "banner_url", description: "Set an image/GIF banner URL (use clear_banner to remove)", maxLength: 500},
  {type: "string", name: "clear_banner", description: "Type yes to remove the current banner", choices: [{name: "Yes", value: "yes"}]},
  {type: "string", name: "color", description: "Embed color as a hex code, for example 3B82F6", maxLength: 7},
], async interaction => {
  if (!interaction.guild) return fail(interaction, "Server only", "Run this command in a server.");
  if (!managerOnly(interaction)) return denyPermission(interaction);
  const patch = {};
    const dm = interaction.options.getBoolean("dm_enabled");
  if (dm !== null) patch.dmEnabled = dm;
  const avatar = interaction.options.getBoolean("show_avatar");
  if (avatar !== null) patch.showAvatar = avatar;
  const rawBanner = interaction.options.getString("banner_url");
  if (rawBanner) {
    const validated = imageUrl(rawBanner);
    if (!validated) return fail(interaction, "Invalid banner URL", "Use a valid HTTP(S) image or GIF URL.");
    patch.bannerUrl = validated;
  }
  if (interaction.options.getString("clear_banner") === "yes") patch.bannerUrl = null;
  const color = interaction.options.getString("color");
  if (color) {
    if (!/^(#)?[0-9a-f]{6}$/i.test(color)) return fail(interaction, "Invalid color", "Use six hex digits, like `3B82F6`.");
    patch.color = color.replace(/^#/, "").toUpperCase();
  }
  if (!Object.keys(patch).length) {
    const config = await getWelcomeConfig(interaction.guild.id);
    return safeReply(interaction, infoEmbed("Welcome settings", `Enabled: **${config.enabled}**\nChannel: ${config.channelId ? `<#${config.channelId}>` : "Not set"}\nBanner: ${config.bannerUrl ? "Configured" : "None"}\nDM: **${config.dmEnabled}**\nAvatar thumbnail: **${config.showAvatar}**\nColor: \`#${config.color}\``));
  }
  await saveConfig("welcome", interaction.guild.id, patch);
  return ok(interaction, "Welcome settings saved", `Updated: ${Object.keys(patch).join(", ")}.`);
});
