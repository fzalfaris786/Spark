import {PermissionFlagsBits as P} from "discord.js";
import {createModuleCommand, managerOnly, denyPermission, ok, fail} from "../commandFactory.js";
import {saveConfig} from "../shared.js";
import {isText, imageUrl} from "./services/index.js";

export default createModuleCommand("welcome-setup", "Set the welcome channel and optional image/GIF banner.", [
  {type: "channel", name: "channel", description: "Channel for welcome messages", required: true, channelType: "text"},
  {type: "string", name: "banner_url", description: "Optional HTTP(S) banner/GIF URL", maxLength: 500},
], async interaction => {
  if (!interaction.guild) return fail(interaction, "Server only", "Run this command in a server.");
  if (!managerOnly(interaction)) return denyPermission(interaction);
  const channel = interaction.options.getChannel("channel", true);
  const rawBanner = interaction.options.getString("banner_url");
  if (!isText(channel)) return fail(interaction, "Invalid channel", "Choose a server text or announcement channel.");
  if (rawBanner && !imageUrl(rawBanner)) return fail(interaction, "Invalid banner URL", "Use a valid HTTP(S) image or GIF URL.");
  const bot = interaction.guild.members.me;
  if (!bot || !channel.permissionsFor(bot)?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks])) {
    return fail(interaction, "Missing bot permissions", "The bot needs View Channel, Send Messages and Embed Links in that channel.");
  }
  await saveConfig("welcome", interaction.guild.id, {channelId: channel.id, bannerUrl: rawBanner ? imageUrl(rawBanner) : null, enabled: true});
  return ok(interaction, "Welcome configured", `Messages will be sent to ${channel}. The module is now enabled. Use /welcome-message to customize the message.`);
});
