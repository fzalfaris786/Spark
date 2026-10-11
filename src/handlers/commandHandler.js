import {readdir} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath, pathToFileURL} from "node:url";
import {createPrefixExecutor} from "../modules/prefixAdapter.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
async function loadDirectCommands(folder, collection, {prefix = false, modulesOnly = false} = {}) {
  let entries;
  try { entries = await readdir(folder, {withFileTypes: true}); }
  catch (error) { if (error.code === "ENOENT") return; throw error; }
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".js")) continue;
    const module = await import(pathToFileURL(path.join(folder, entry.name)));
    const command = module.default;
    if (!command?.name || typeof command.execute !== "function") continue;
    if (modulesOnly && !command.data?.toJSON && !(prefix && command.prefixOnly)) continue;
    if (!prefix && !command.data?.toJSON) continue;
    let execute = command.execute;
    if (prefix && modulesOnly && command.prefixOnly) execute = command.execute;
    else if (prefix && modulesOnly) execute = command.prefixExecute || createPrefixExecutor(command);
    else if (prefix) execute = command.prefixExecute || command.execute;
    if (typeof execute !== "function") continue;
    if (!collection.has(command.name)) collection.set(command.name, prefix ? {...command, execute} : command);
    else throw new Error(`Duplicate ${prefix ? "prefix" : "slash"} command '${command.name}' discovered at ${entry.name}`);
  }
}

export async function loadAllCommands(client) {
  client.slashCommands.clear();
  client.prefixCommands.clear();
  const commandsRoot = path.join(root, "src/commands");
  await loadDirectCommands(path.join(commandsRoot, "slash"), client.slashCommands);
  await loadDirectCommands(path.join(commandsRoot, "prefix"), client.prefixCommands, {prefix: true});
  const modulesRoot = path.join(root, "src/modules");
  for (const dir of await readdir(modulesRoot, {withFileTypes: true})) {
    if (!dir.isDirectory()) continue;
    await loadDirectCommands(path.join(modulesRoot, dir.name), client.slashCommands, {modulesOnly: true});
    await loadDirectCommands(path.join(modulesRoot, dir.name), client.prefixCommands, {prefix: true, modulesOnly: true});
  }
  console.log(`[commands] ${client.slashCommands.size} slash, ${client.prefixCommands.size} prefix loaded`);
}
