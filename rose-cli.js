/**
 * Rose Command line interface
 *
 * @author Asuman Suenbuel
 */

const program = require('commander');

const { login, logout } = require('./src/cli/cli-auth');
const commands = require('./src/cli/commands')

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
    .command('ls <entity> [name-pattern]')
    .option('-j, --json', 'output in json format', false)
    .option('-f, --fields <comma-separated-fields>',null)
    .action(commands.list)
    .description('list the entities (robots, backend_systems, connections) '
		 + 'whose name matches the name-pattern')

program
    .command('edit-config <class-or-instance-name>')
    .action(commands.edit)
    .description('command to edit config of the class or an instance')

program
    .command('init-scenario')
    .action(commands.initScenario)
    .description('initialize the current folder with a scenario class (interactively)')

program
    .command('info')
    .action(commands.folderInfo)
    .description('get information about which directories are connected with which '
		 + 'scenario class and instances')

program.parse(process.argv);


