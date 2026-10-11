import {PermissionFlagsBits as P} from "discord.js";
import {createModuleCommand, managerOnly, denyPermission, ok, fail} from "../commandFactory.js";
import {saveConfig} from "../shared.js";

export default createModuleCommand(
  "automod-setup",
  "Configure an AutoMod log channel and enable baseline protection.",
  [{type: "channel", name: "log_channel", description: "Optional channel for violation logs", channelType: "text"}],
  async interaction => {
    if (!interaction.guild) return fail(interaction, "Server only", "Run this command in a server.");
    if (!managerOnly(interaction)) return denyPermission(interaction);
    const bot = interaction.guild.members.me;
    if (!bot?.permissions.has(P.ManageMessages)) return fail(interaction, "Manage Messages required", "Give the bot Manage Messages so it can remove violating content before enabling AutoMod.");
    const channel = interaction.options.getChannel("log_channel");
    if (channel && !channel.isTextBased?.()) return fail(interaction, "Invalid channel", "Choose a text channel.");
    if (channel && (!bot || !channel.permissionsFor(bot)?.has([P.ViewChannel, P.SendMessages, P.EmbedLinks]))) {
      return fail(interaction, "Log channel permissions missing", "Give the bot View Channel, Send Messages and Embed Links in the selected log channel.");
    }
    await saveConfig("automod", interaction.guild.id, {enabled: true, ...(channel ? {logChannelId: channel.id} : {})});
    return ok(interaction, "AutoMod configured", "AutoMod is enabled with invite protection, anti-spam, mention-spam and caps checks. Tune behavior with `/automod-config`.");
  }
);
