/**
 * Rose Command line interface
 *
 * @author Asuman Suenbuel
 */

const program = require('commander');

const { login, logout } = require('./src/cli/cli-auth');
const commands = require('./src/cli/commands')
const { cliInfo, cliWarn, cliError, stringFormat } = require('./src/cli/cli-utils');
const { blue } = require('chalk');

const help = require('./src/cli/help-texts')

program
    .name('rose')
    .description(help.commands.rose)

program
    .command('login')
    .option('-f, --force', 'force new login', false)
    .action(login)
    .description('authenticate a user for Rose command line interface (for the current shell)')

program
    .command('logout')
    .action(logout)
    .description('remove authentication info for Rose command line (for the current shell)')

program
    .command('user')
    .option('-j, --json', 'output in json format', false)
    .option('-s, --short', 'output short form', true)
    .action(commands.user)
    .description('shows info about the user currently authenticated for the Rose command line interface')

program
    .command('server')
    .action(commands.server)
    .description('show the RoseStudio server url')

program
    .command('ls <robots|systems|scenarios|instances> [name-pattern|uuid]')
    .option('-j, --json', 'output in json format', false)
    .option('-u, --uuid',
	    'output only (comma-separated) uuid(s); can be used '
	    + 'to pass arguments to other rose commands',
	    false)
    .option('-f, --fields <comma-separated-fields>',null)
    .action(commands.list)
    .description(help.commands.ls)

program
    .command('info [folder]')
    .option('-l, --link', 'include the link to the object\'s RoseStudio page for each entry', false)
    .action(commands.info)
    .description(help.commands.info)

program
    .command('init-scenario [folder]')
    .action(commands.initScenario)
    .option('-c, --create', help.commandOptions.initScenario.create)
    .description(help.commands.initScenario)

program
    .command('create-scenario [folder]')
    .action(commands.createScenario)
    .description(help.commands.createScenario)

program
    .command('init-instance <scenario-class-folder>')
    .action(commands.initInstance)
    .description(help.commands.initInstance)

program
    .command('edit-config <scenario-folder>')
    .option('-n, --no-update', help.commandOptions.editConfig.noUpdate)
    .action(commands.edit)
    .description(help.commands.editConfig)

program
    .command('update-scenario <scenario-class-folder>')
    .option('-f, --full', help.commandOptions.updateScenario.full)
    .action(commands.updateScenario)
    .description(help.commands.updateScenario)

program
    .command('update-instance <scenario-instance-folder>')
    .option('-n, --no-class-update', help.commandOptions.updateInstance)
    .action(commands.updateInstance)
    .description(help.commands.updateInstance)

program
    .command('update <scenario-class-or-instance-folder>')
    .option('-n, --no-class-update', help.commandOptions.updateInstance)
    .option('-f, --full', help.commandOptions.updateScenario.full)
    .action(commands.updateScenarioOrInstance)
    .description(help.commands.update)

program
    .command('open <name-pattern>')
    .action(commands.open)
    .description(help.commands.open)

const parsed = program.parse(process.argv);

const commandName = parsed.rawArgs[2];


const registeredCommands = program.commands.map(cmd => cmd.name());
const _isRegisteredCommand = cmd => {
    let command = cmd || commandName
    return registeredCommands.includes(command);
}

if (process.argv.length === 2) {
  program.help();
}

if ((typeof commandName === 'string') && !_isRegisteredCommand()) {
    cliInfo(stringFormat('*** ' + help.commands.unknownCommand,
			 commandName,
			 registeredCommands.map(s => blue(s)).join('\n  ')));
}
