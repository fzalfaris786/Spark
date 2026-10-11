import {errorEmbed} from "../utils/embeds.js";
import {handleModuleInteraction} from "../modules/runtime.js";
export default {
  name: "interactionCreate",
  async execute(interaction, client, env) {
    try {
      const handled = await handleModuleInteraction(interaction);
      if (handled) return;
    } catch (e) {
      console.error(`[component:${interaction.customId || "unknown"}]`, e);
      if (interaction.isRepliable?.() && !interaction.replied && !interaction.deferred) {
        await interaction.reply({embeds:[errorEmbed("Something went wrong", "This interaction could not be completed. Please try again or contact a server administrator.")],ephemeral:true}).catch(()=>{});
      } else if (interaction.deferred && interaction.editReply) {
        await interaction.editReply({embeds:[errorEmbed("Something went wrong", "This interaction could not be completed. Please try again or contact a server administrator.")]}).catch(()=>{});
      }
      return;
    }
    if (!interaction.isChatInputCommand()) return;
    const cmd = client.slashCommands.get(interaction.commandName);
    if (!cmd) return;
    try {
      await cmd.execute({interaction, client, env});
    } catch (e) {
      console.error(`[slash:${interaction.commandName}]`, e);
      const payload = {embeds: [errorEmbed("Something went wrong", "This command could not be completed. Please try again in a moment.")], ephemeral: true};
      if (interaction.replied || interaction.deferred) await interaction.followUp(payload);
      else await interaction.reply(payload);
    }
  },
};
