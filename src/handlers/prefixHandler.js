import {errorEmbed} from "../utils/embeds.js";
export async function handlePrefixMessage(message, client, env) {
  if (message.author.bot || !message.guild || !message.content.startsWith(env.prefix)) return;
  const [name, ...args] = message.content.slice(env.prefix.length).trim().split(/\s+/);
  if (!name) return;
  const cmd = client.prefixCommands.get(name.toLowerCase());
  if (!cmd) return;
  try {
    await cmd.execute({message, client, args, env});
  } catch (e) {
    console.error(`[prefix:${name}]`, e);
    await message.reply({embeds: [errorEmbed("Something went wrong", "This command could not be completed. Please try again in a moment.")]});
  }
}
