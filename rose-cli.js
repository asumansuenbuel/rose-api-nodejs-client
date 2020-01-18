/**
 * Rose Command line interface
 *
 * @author Asuman Suenbuel
 * @ignore
 */

const program = require('commander');

const { login, logout } = require('./src/cli/cli-auth');
const commands = require('./src/cli/commands')
const { cliInfo, cliWarn, cliError, stringFormat, getTmpFile, runSystemCommand } = require('./src/cli/cli-utils');
const { blue } = require('chalk');

const { help } = require('./src/cli/help-texts')

const _getRegisteredCommands = (onlyVisible) => {
    const fn = onlyVisible ? (cmd => !cmd._noHelp) : (() => true);
    const registeredCommands = program.commands.filter(fn).map(cmd => cmd.name());
    return registeredCommands;
}


/**
 * The shell command for invoking the Rose command line interface. All
 * rose commands are described in this page. If called no command then
 * the help output is displayed. 

 * #### Usage
 * `rose [options] [command] ... `
 *
 * #### Options
 *
 * |Name&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;|Description|
 * |-|-|
 * | `-h, --help` | Show usage information. The option `-h` or `--help` is also defined for all commands implicitly. Help for a specific command can be shown using `rose <commmand> --help`. |
 *
 * @global
 * @name rose
 */

program
    .name('rose')
    .description(help.commands.rose)

/**
 * Authenticate a user for Rose command line interface (for the current shell)
 * #### Usage
 * `rose login [options]`
 *
 * #### Options
 *
 * |Name|Description|
 * |-|-|
 * | `-f, --force` | Perform the login operation even is a user is currently logged in.|
 *
 * @global
 * @name login
 */
program
    .command('login')
    .option('-f, --force', 'force new login', false)
    .action(login)
    .description('authenticate a user for Rose command line interface (for the current shell)')

/**
 * remove authentication info for Rose command line (for the current shell).
 * 
 * #### Usage
 * `rose logout`
 * @global
 * @name logout
 */
program
    .command('logout')
    .action(logout)
    .description('remove authentication info for Rose command line (for the current shell)')

/**
 * show information about the user currently authenticated for the Rose
 * command line interface.
 *
 * #### Usage
 * `rose user`
 * #### Options
 *
 * |Name|Description|
 * |-|-|
 * | `-j, --json` | output in json format|
 *
 * @global
 * @name user
 */
program
    .command('user')
    .option('-j, --json', help.commandOptions.common.json, false)
    .option('-s, --short', 'output short form', true)
    .action(commands.user)
    .description(help.commands.user)

/**
 * show the RoseStudio server url.
 * #### Usage
 * `rose server`
 * @global
 * @name server
 */
program
    .command('server')
    .action(commands.server)
    .description('show the RoseStudio server url')

/**
 * list the entities (robots, backend_systems, scenarios) whose name
 * matches the name-pattern. Alternatively, an object uuid can be
 * provided in which case information about the object with that uuid is
 * shown. In order to list the instances of a scenario class, the format
 * "`ls [options] instances <name-pattern|uuid>`"
 * can be used. In this
 * case, the name (pattern) must uniquely describe a scenario class.
 *
 * #### Usage
 * `rose ls [options] <robots|systems|scenarios|instances> [name-pattern|uuid]`

 * #### Options
 * |Name|Description|
 * |-|-|
 * | `-j, --json` | output in json format|
 * | `-u, --uuid` | output only uuid(s); useful if command is used as a sub-shell command to pass the uuid to other rose commands.|
 * | `-f, --fields` | comma-separated list of field names to be included in the output, e.g. `rose ls robots -f "NAME,Manufacturer"`|


 * @global
 * @name ls
 */
program
    .command('ls <entity> [name-pattern|uuid]')
    .option('-j, --json', help.commandOptions.common.json, false)
    .option('-u, --uuid', help.commandOptions.common.uuid, false)
    .option('-f, --fields <comma-separated-fields>',help.commandOptions.ls.fields, null)
    .action(commands.list)
    .description(help.commands.ls)

/**
 * get information about which directories are connected with which
 * scenario class and instances. If the folder argument is given, only
 * information related to that folder is shown.
 *
 * An example output is as follows:

```plain
 Folder                        Name in RoseStudio       Type      UUID                                 
 FooLocal                      FooLocal                 class     586f14db-e121-8f74-b30f-8b070579ad51 
  └── FooLocalInstance01       FooLocalInstance01       instance  b4e9c8bf-de02-6f68-00ab-b7da1adb45bb 
  └── FooLocalInstance27       FooLocalInstance27       instance  33959052-993c-148a-faf2-b5262b3844f2 
  └── test-instance-01         test-instance-01         instance  51611cb9-83cd-1022-0ed3-4f712b6b6e7d 
 Gazebo/Demo                   Gazebo Demo              class     a8f4149f-f5eb-fc90-174e-77932c5ed306 
  └── GazeboDemo-CustomerA     Customer A Instance      instance  4baa8fc7-ec3a-85af-5115-985381bfedec 
  └── GazeboDemo-CustomerB     Customer B Instance      instance  7780c188-bcb1-86e9-3589-a5f59e4f8142 
 MyNewScenario                 MyNewScenario            class     e4a69ec6-8869-13ca-f658-28b2b60ef254 
  └── MyNewScenarioInstance01  MyNewScenarioInstance01  instance  406a0b0d-2d84-0983-83c4-cbae7b2ea300 
 Oilrig                        Oilrig                   class     bca5e1d4-bf8b-7fd1-b8c9-623206f92d2e 
 hd-pilot                      hd-pilot-2               class     05c55459-9e53-1cfe-fd73-c6a404a419f5 
  └── hd-pilot-teal            test-instance-02         instance  9ff338d3-12d4-8f16-f912-38906dd5da11 
```

The  table lists  all local  folders that  are connection  to scenario
class  and instances  in RoseStudio.  The output  also visualizes  the
scenario instances beloning to which scenario class.

Note, that this command shows the local folders that are
connected to RoseStudio artifacts. In order to inspect RoseStudio
objects, use the ``rose ls`` command instead.

 *
 * #### Usage
 * `rose info [options] [folder]`
 *
 * #### Options
 * |Name|Description|
 * |-|-|
 * | `-l, --link` | include the link to the object's RoseStudio page for each entry|
 *
 * @global
 * @name info
 */
program
    .command('info [folder]')
    .option('-l, --link', help.commandOptions.link, false)
    .action(commands.info)
    .description(help.commands.info)

/**

interactively initialize a local sub-folder with a RoseStudio scenario
class. If the folder argument is specified, it has to
be a folder that is not yet connected to any Rose artifact. In this
case, a new scenario class is created in RoseStudio and will be
assicated with the folder. All required information is requested
interactively.

 *
 * #### Usage
 * `rose init-scenario [options] [folder]`
 *
 * #### Options
 * |Name|Description|
 * |-|-|
 * | `-c, --create` | creates a new scenario in RoseStudio; the name is inquired interactively|
 *
 * @global
 * @name init-scenario
 */
program
    .command('init-scenario [folder]')
    .action(commands.initScenario)
    .option('-c, --create', help.commandOptions.initScenario.create)
    .description(help.commands.initScenario)

/**
 * same as "init-scenario --create ..."
 *
 * #### Usage
 * `rose create-scenario [folder]`
 * @global
 * @name create-scenario
 */
program
    .command('create-scenario [folder]')
    .action(commands.createScenario)
    .description(help.commands.createScenario)

/**
 * initialize a local sub-folder with a RoseStudio scenario instance
 * (interactively); the scenario-class-folder parameter must refer to
 * a local folder that has been initialized using the "init-scenario"
 * command. This command can also be used to create new instances in
 * RoseStudio for the given scenario class and connect it with a local
 * folder.
 *
 *
 * #### Usage
 * `rose init-instance [options] <scenario-class-folder>`
 *
 * #### Options
 * |Name|Description|
 * |-|-|
 * | `-c, --create` | creates a new instance in RoseStudio; the name is inquired interactively|
 *
 * @global
 * @name init-instance
 */
program
    .command('init-instance <scenario-class-folder>')
    .option('-c, --create', help.commandOptions.initInstance.create)
    .action(commands.initInstance)
    .description(help.commands.initInstance)

/**
 * same as "init-instance --create ..."
 *
 * #### Usage
 * `rose create-instance <scenario-class-folder>`
 * @global
 * @name create-instance
 */
program
    .command('create-instance <scenario-class-folder>')
    .action(commands.createInstance)
    .description(help.commands.createInstance)

/**
 * dumps the config-json of the scenario in the given folder or the
 * one that matches the name pattern.
 * @global
 * @name show-config
 */
program
    .command('show-config <scenario-folder|name-pattern>')
    .action(commands.showConfig)
    .description(help.commands.showConfig)

/**
 * call the system editor to edit config of the scenario class or
 * instance that is associated with the given folder. The system
 * editor can be changed by setting the shell-level environment variable
 * `EDITOR`; if not set "`vi`" is used.
 *
 * #### Usage
 * `rose edit-config [options] <scenario-folder>`
 *
 * #### Options
 * |Name<div style="width: 200px">|Description|
 * |-|-|
 * | `-n, --no-update` | If the scenario folder is connected to a scenario *instance*, adding this flag prevents an update on that folder, i.e. the updated generated code will *not* be downloaded from the server.|
 *
 * @global
 * @name edit-config
 */
program
    .command('edit-config <scenario-folder>')
    .option('-n, --no-update', help.commandOptions.editConfig.noUpdate)
    .action(commands.edit)
    .description(help.commands.editConfig)

/**
 * uploads the contents of the scenario-class-folder as code template
 * to the associated RoseStudio scenario class. The folder must have
 * been associated with the scenario class using "`rose init-scenario`"
 * command. Note, that all code content for that class on the
 * RoseStudio is overwritten by the contents of the local folder
 * through this command. If the "-full" option is specified, all
 * instances of the scenario class that are associated with a local
 * folder are updated as well.
 *
 *
 * #### Usage
 * `rose update-scenario [options] <scenario-class-folder>`
 *
 * #### Options
 * |Name<div style="width: 200px"></div>|Description| Default Value |
 * |-|-|-|
 * | `-f, --full` | If specified, all instances of the scenario class that are associated with a local folder are updated after the scenario class has been updated with the content of the local folder.|
 * | `-w, --wipe`| Only used when `--full` is given; option is then used while updating the connected instances of the scenario class. |false|
 * | `-s, --skip-confirm` | Only used when `--full` is given; option is then used while updating the connected instances of the scenario class. | false |
 * | `-i, --instances-only` | Only updates the instances of the scenario class; the scenario class itself is not updated on the Rose server. | false |
 *
 *
 * @global
 * @name update-scenario
 */
program
    .command('update-scenario <scenario-class-folder>')
    .option('-f, --full', help.commandOptions.updateScenario.full)
    .option('-w, --wipe', help.commandOptions.updateScenario.wipe, false)
    .option('-s, --skip-confirm', help.commandOptions.updateScenario.skipConfirm, false)
    .option('-i, --instances-only', help.commandOptions.updateScenario.instancesOnly, false)
    .action(commands.updateScenario)
    .description(help.commands.updateScenario)

/**
 * runs code generation on the Rose server and downloads the code to
 * the folder which must be one that is connected to a scenario
 * instance. If the corresponding scenario class is connected to a
 * local sub-folder then its code is uploaded to the server prior to
 * code-generation and download of the instance code.
 *
 * #### Usage
 * `rose update-instance [options] <scenario-instance-folder>`
 *
 * #### Options
 * |Name<div style="width: 200px">|Description|Default Value|
 * |-|-|-|
 * | `-n, --no-class-update` | By default, the code from the corresponding scenario class is first uploaded to the Rose server. Specifying this option omits that step.|false|
 * | `-w, --wipe`| if set, wipes out the contents of the instance folder prior to populating it with updated content from the scenario class. Otherwise, the new content will be copied on top of any existing content in the instance folder.|false|
 * | `-s, --skip-confirm` | If wipe option is set, then by default, the user is asked interactively to confirm the wiping out of the instance folder contents. Setting this option skips this confirmation.| false |
 *
 * @global
 * @name update-instance
 */
program
    .command('update-instance <scenario-instance-folder>')
    .option('-n, --no-class-update', help.commandOptions.updateInstance.noClassUpdate, true)
    .option('-w, --wipe', help.commandOptions.updateInstance.wipe, false)
    .option('-s, --skip-confirm', help.commandOptions.updateInstance.skipConfirm, false)
    .action(commands.updateInstance)
    .description(help.commands.updateInstance)

/**
 * same as "update-scenario", if the folder is connected to a scenario *class*; same as "update-instance", if the folder is connected to a scenario *instance*
 *
 * #### Usage
 * `rose update [options] <scenario-class-or-instance-folder>`
 *
 * #### Options
 * |Name<div style="width: 200px">|Description|
 * |-|-|
 * | `-f, --full` | see `--full` option for `update-scenario` command.|
 * | `-n, --no-class-update` | see `--no-class-update` option for `update-instance` command.|
 * | `-w, --wipe` | see `--wipe` option for `update-instance` and `update-scenario` command.|
 * | `-s, --skip-confirm` | see `--skip-confirm` option for `update-instance` and `update-scenario` command.|
 *
 * @global
 * @name update
 */
program
    .command('update <scenario-class-or-instance-folder>')
    .option('-f, --full', help.commandOptions.updateScenario.full)
    .option('-n, --no-class-update', help.commandOptions.updateInstance.noClassUpdate, true)
    .option('-w, --wipe', help.commandOptions.updateInstance.wipe, false)
    .option('-s, --skip-confirm', help.commandOptions.skipConfirm, false)
    .action(commands.updateScenarioOrInstance)
    .description(help.commands.update)

/**
 * opens the RoseStudio web page in the web-browser for the object
 * matching the name pattern; the entity name (connections, robots,
 * backend_systems) doesn't need to be specified. If the name-pattern
 * is omitted, the RoseStudio start page is opened.
 *
 * #### Usage
 * `rose open [name-pattern]
 * @global
 * @name open
 */
program
    .command('open [name-pattern]')
    .action(commands.open)
    .description(help.commands.open)

/**
 * this is a convenience command that can be used to enable bash
 * completion for the rose command. Using the following on your bash
 * command line enables the command completion for Rose: `$(rose
 * bash-enable-completion)`
 *
 *
 * #### Usage
 * `rose bash-enable-completion`
 * @global
 * @name bash-enable-completion
 */
program
    .command('bash-enable-completion')
    .action(() => {
	const tmpFile = getTmpFile();
	const cmd = `complete -W "${_getRegisteredCommands(true).join(' ')}" -o dirnames rose`;
	require('fs').writeFileSync(tmpFile, cmd, 'utf-8');
	console.log(`source ${tmpFile}`);
    })
    .description(help.commands.bashEnableCompletion)

/**
 * Shows the Rose CLI version in the form X.Y.Z
 *
 * #### Usage
 * `rose version`
 * @global
 * @name version
 */
program
    .command('version')
    .action(() => {
	let { version } = require('./package');
	cliInfo(version);
    })
    .description('display the current Rose CLI/API version')

program
    .command('update-rose', { noHelp: true })
    .action(() => {
	cliInfo('updating rose...');
	let cmd = 'npm install git+https://github.com/asumansuenbuel/rose-api-nodejs-client.git';
	runSystemCommand(cmd);
    })


const parsed = program.parse(process.argv);

const commandName = parsed.rawArgs[2];

const _isRegisteredCommand = cmd => {
    const commands = _getRegisteredCommands();
    const command = cmd || commandName
    return commands.includes(command);
}

if (process.argv.length === 2) {
  program.help();
}

if ((typeof commandName === 'string') && !_isRegisteredCommand()) {
    cliInfo(stringFormat('*** ' + help.commands.unknownCommand,
			 commandName,
			 _getRegisteredCommands(true).map(s => blue(s)).join('\n  ')));
}
