
const { bold, green, blue } = require('chalk');

const format = (text, lineLength = 80) => {
    const words = text.split(/\s+/);
    const lines = [];
    var currentLine = [];
    words.forEach(word => {
	let wlen = word.length;
	let llen = currentLine.join(" ").length;
	if (llen + wlen > lineLength) {
	    lines.push(currentLine);
	    currentLine = [];
	}
	currentLine.push(word);
    });
    if (currentLine.length > 0) {
	lines.push(currentLine);
    }
    const longestLineLength = lines.reduce((max, line) => Math.max(line.join(' ').length, max), -1);
    //console.log(`longest line length: ${longestLineLength}`);
    const formattedLines = lines.map(words => {
	if (words.join(" ").length < longestLineLength * 0.8) {
	    return
	}
	while (words.join(' ').length < longestLineLength) {
	    let index = Math.trunc(Math.random() * (words.length - 1)) + 1;
	    words.splice(index,0,'');
	}
    });
    const formattedText = lines.map(words => words.join(' ')).join('\n');
    return formattedText;
}

const helpTexts = {
    commands: {
	rose: format("The RoseStudio command line interface allows to access artifacts and"
		     + " resource from the RoseStudio website from the local command line."
		     + " It uses the the Rose API to make calls to the RoseStudio server."
		     + " In particular, the command line interface enables to associate"
		     + " local folders with scenario class and instances. More documentation at"
		     + " https://rose-studio.cfapps.us10.hana.ondemand.com/doc/api/index.html."),
	ls: "list the entities (robots, backend_systems, scenarios)"
	    + " whose name matches the name-pattern."
	    + " Alternatively, an object uuid can be provided in which case"
	    + " information about the object with that uuid is shown."
	    + " In order to list the instances of a scenarion class, the format"
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
	updateInstance: "runs code generation on the rose server and downloads the code to the folder"
	    + " which must be one that is connected to a scenarion instance."
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
	    + " folder through this command. If the \"-full\" option is specified, all instances"
	    + " of the scenario class that are associated with a local folder are updated as well.",
	update: "same as \"update-scenario\", if the folder is connected to a scenario *class*;"
	    + " same as \"update-instance\", if the folder is connected to a scenario *instance*",
	open: "opens the RoseStudio web page for the object matching the name pattern; the entity"
	    + " name (connections, robots, backend_systems) doesn't need to be specified.",
	bashEnableCompletion: "this is a convenience command that can be used to enable bash completion for the rose command. Using the following on your bash command line enables the command completion for Rose: " + bold("$(rose bash-enable-completion)"),
	unknownCommand: "Unknown command \"{0}\"; commands are \n  "
	    + "{1}\n or \"--help\" for usage information."
    },
    commandOptions: {
	editConfig: {
	    noUpdate: "If the scenario folder is connected to a scenario *instance*, adding this flag"
		+ " prevents an update on that folder, i.e. the updated generated code will *not*"
		+ " be downloaded from the server."
	},
	initScenario: {
	    create: "creates a new scenario in RoseStudio; the name is inquired interactively",
	},
	updateScenario: {
	    full: "If specified, all instances of the scenario class that are associated with a"
		+ " local folder are updated after the scenario class has been updated with the"
		+ " content of the local folder."
	},
	updateInstance: {
	    noClassUpdate: "By default, the code from the corresponding scenario class is"
		+ " first uploaded to the Rose server. Specifying this option omits that step"
	}
    }
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

module.exports = helpTexts;

if (require.main === module) {
    cmd = process.argv[2];
    console.log(helpTexts.commands[cmd]);
}
