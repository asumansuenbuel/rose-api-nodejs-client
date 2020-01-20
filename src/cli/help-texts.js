
const { bold, green, blue } = require('chalk');
const { formatText } = require('./cli-utils');
const format = formatText;

const help = {
    commands: {
	rose: format("The RoseStudio command line interface allows to access artifacts and"
		     + " resource from the RoseStudio website from the local command line."
		     + " It uses the the Rose API to make calls to the RoseStudio server."
		     + " In particular, the command line interface enables to associate"
		     + " local folders with scenario class and instances. More documentation at"
		     + " https://rose-studio.cfapps.us10.hana.ondemand.com/doc/api/index.html."),
	ls: "list RoseStudio entities; the parameter `entity` can be one of \"robots\","
	    + " \"systems\", \"scenarios\", or \"instances\""
	    + " whose name matches the name-pattern."
	    + " Alternatively, an object uuid can be provided in which case"
	    + " information about the object with that uuid is shown."
	    + " In order to list the instances of a scenario class, the format"
	    + "\n-\t" + bold('"ls [options] instances <name-pattern|uuid>"') + "\n"
	    + "can be used. In this case, the name (pattern)"
	    + " must uniquely describe a scenario class.",
	user: "shows info about the user currently authenticated for the Rose command"
	    + " line interface",
	initScenario: bold("[interactive]") + " initialize a local sub-folder with a RoseStudio scenario class (interactively)."
	    + " If the folder argument is specified, it has to be a folder that is not yet connected"
	    + " to any Rose artifact. In this case, a new scenario class is created in RoseStudio"
	    + " and will be assicated with the folder. All required information is requested"
	    + " interactively.",
	createScenario: bold("[interactive]") + " same as \"init-scenario --create ...\"",
	initInstance: bold("[interactive]") + " initialize a local sub-folder with a RoseStudio scenario instance (interactively);"
	    + " the scenario-class-folder parameter must refer to a local folder that has"
	    + " been initialized using the \"init-scenario\" command.",
	createInstance: bold("[interactive]") + " same as \"init-instance --create ...\"",
	updateInstance: "runs code generation on the rose server and downloads the code to the folder"
	    + " which must be one that is connected to a scenario instance."
	    + " If the corresponding scenario class is connected to a local sub-folder then its"
	    + " code is uploaded to the server prior to code-generation and download of the"
	    + " instance code",
	info: "get information about which directories are connected with which"
	    + " scenario class and instances. If the folder argument is given,"
	    + " only information related to that folder is shown",
	editConfig: "command to edit config of the class or an instance that is associated"
	    + " with the given folder.",
	updateScenario: "uploads the contents of the scenario-class-folder as code template to the"
	    + " associated RoseStudio scenario class. The folder must have been associated with the"
	    + " scenario class using \"rose init-scenario\" command. Note, that all code content"
	    + " for that class on the RoseStudio is overwritten by the contents of the local"
	    + " folder through this command. If the \"-all\" option is specified, all instances"
	    + " of the scenario class that are associated with a local folder are updated as well.",
	update: "same as \"update-scenario\", if the folder is connected to a scenario *class*;"
	    + " same as \"update-instance\", if the folder is connected to a scenario *instance*",
	open: "opens the RoseStudio web page for the object matching the name pattern; the entity"
	    + " name (connections, robots, backend_systems) doesn't need to be specified.",
	bashEnableCompletion: "this is a convenience command that can be used to enable bash"
	    + " completion for the rose command. Using the following on your bash command"
	    + " line enables the command completion for Rose: "
	    + bold("$(rose bash-enable-completion)"),
	cleanup: "cleans up the current folder and checks whether the Rose scenarios that are"
	    + " connected to local folder still exist on the server. If not, the local folder"
	    + " is disconnected from the non-existing object; the folder itself remains untouched.",
	unknownCommand: "Unknown command \"{0}\"; commands are \n  "
	    + "{1}\n or \"--help\" for usage information."
    },
    commandOptions: {
	common: {
	    uuid: "output only uuid(s); useful if command is used as a sub-shell"
		+ " command to pass the uuid to other rose commands.",
	    json: "output in json format.",
	    link: "include the link to the object\'s RoseStudio page for each entry"
	},
	ls: {
	    fields: "comma-separated list of field names to be included in the output"
	},
	editConfig: {
	    noUpdate: "If the scenario folder is connected to a scenario *instance*, adding this flag"
		+ " prevents an update on that folder, i.e. the updated generated code will *not*"
		+ " be downloaded from the server."
	},
	initScenario: {
	    create: "creates a new scenario in RoseStudio; the name is inquired interactively",
	},
	initInstance: {
	    create: "creates a new instance in RoseStudio; the name is inquired interactively",
	},
	updateScenario: {
	    all: "If specified, all instances of the scenario class that are associated with a"
		+ " local folder are updated after the scenario class has been updated with the"
		+ " content of the local folder.",
	    wipe: "Only used when `--all` is given; option is then used while updating the"
		+ " connected instances of the scenario class.",
	    skipConfirm: "Only used when `--all` is given; option is then used while updating the"
		+ " connected instances of the scenario class.",
	    instancesOnly: "Only updates the instances of the scenario class; the scenario class itself is not updated on the Rose server.",
	    force: "By default, only files that have changed since last upload are being uploaded;"
		+ " using this option forces that all relevant files from the scenario class folder"
		+ " are uploaded to the Rose server."
	},
	updateInstance: {
	    noClassUpdate: "By default, the code from the corresponding scenario class is"
		+ " first uploaded to the Rose server. Specifying this option omits that step",
	    wipe: "If set, wipes out the contents of the instance folder prior to populating"
		+ " it with updated content from the scenario class. Otherwise, the new content"
		+ " will be copied on top of any existing content in the instance folder.",
	    skipConfirm: "By default, the user is asked interactively"
		+" to confirm the wiping out or overwriting of the instance folder contents."
		+ " Setting this option skips this confirmation.",
	    force: "This option is passed onto the update-scenario part; see its description there."
	},
	update: {
	    check: "runs a check whether the local folder info must be updated on the folder(s) involved in the operation"
	}
    }
}

const messages = {
    confirmWipeInstanceFolder: `About to copy files into instance folder "{0}";`
	+` all current content will be wiped out. Do you want to continue?`,
    confirmOverwriteInstanceFolder: `About to copy files into instance folder "{0}";`
	+` files will be overwritten. Do you want to continue?`
}


const formatStringsInObject = obj => {
    Object.keys(obj).forEach(key => {
	const val = obj[key];
	if (typeof val === 'string') {
	    obj[key] = format(val, 70);
	}
	else if (typeof val === 'object') {
	    formatStringsInObject(val);
	}
    })
    return obj;
};

module.exports = { help, messages }

if (require.main === module) {
    let cmd = process.argv[2];
    let parts = cmd.split('.');
    let s;
    if (parts.length === 2) {
	let copt = help.commandOptions[parts[0]]
	s = copt[parts[1]]
    } else {
	s = help.commands[cmd];
    }
    console.log(s);
}
