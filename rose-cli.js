/**
 * Rose Command line interface
 *
 * @author Asuman Suenbuel
 */

const program = require('commander');

const { login, logout } = require('./src/cli/cli-auth');
const commands = require('./src/cli/commands')

program
    .name('rose');

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
    .command('ls <entity> [name-pattern|uuid]')
    .option('-j, --json', 'output in json format', false)
    .option('-u, --uuid',
	    'output only (comma-separated) uuid(s); can be used '
	    + 'to pass arguments to other rose commands',
	    false)
    .option('-f, --fields <comma-separated-fields>',null)
    .action(commands.list)
    .description('list the entities (robots, backend_systems, connections) '
		 + 'whose name matches the name-pattern. '
		 + 'Alternatively, an object uuid can be provided in which case'
		 + 'information about the object with that uuid is shown.')

program
    .command('edit-config <class-or-instance-name>')
    .action(commands.edit)
    .description('command to edit config of the class or an instance')

program
    .command('init-scenario')
    .action(commands.initScenario)
    .description('initialize a local sub-folder with a RoseStudio scenario class (interactively)')

program
    .command('init-instance <scenario-class-folder>')
    .action(commands.initInstance)
    .description(
	`initialize a local sub-folder with a RoseStudio scenario instance (interactively);
the scenario-class-folder parameter must refer to a local folder that has
been initialized using the "init-scenario" command.`)

program
    .command('update-instance <scenario-instance-folder>')
    .option('-n, --no-class-update', 'By default, the code from the corresponding scenario class is '
	    + 'first uploaded to the Rose server. Specifying this option omits that step')
    .action(commands.updateInstance)
    .description('runs code generation on the rose server and downloads the code to the folder '
		 + 'which must be one that is connected to a scenarion instance.'
		 + 'If the corresponding scenario class is connected to a local sub-folder then its '
		 + 'code is uploaded to the server prior to code-generation and download of the '
		 + 'instance code')

program
    .command('info [folder]')
    .option('-l, --link', 'include the link to the object\'s RoseStudio page for each entry', false)
    .action(commands.info)
    .description('get information about which directories are connected with which '
		 + 'scenario class and instances. If the folder argument is given, '
		 + 'only information related to that folder is shown')

program.parse(process.argv);


