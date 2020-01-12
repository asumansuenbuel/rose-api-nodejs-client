
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
	ls: "list the entities (robots, backend_systems, connections)"
	    + " whose name matches the name-pattern."
	    + " Alternatively, an object uuid can be provided in which case"
	    + " information about the object with that uuid is shown.",
	updateInstance: "runs code generation on the rose server and downloads the code to the folder"
	    + " which must be one that is connected to a scenarion instance."
	    + " If the corresponding scenario class is connected to a local sub-folder then its"
	    + " code is uploaded to the server prior to code-generation and download of the"
	    + " instance code",
	info: "get information about which directories are connected with which"
	    + " scenario class and instances. If the folder argument is given,"
	    + " only information related to that folder is shown",
	editConfig: "command to edit config of the class or an instance that is associated"
	    + " with the given folder."
    },
    commandOptions: {
	editConfig: {
	    noUpdate: "If the scenario folder is connected to a scenario *instance*, adding this flag"
		+ " prevents an update on that folder, i.e. the updated generated code will *not*"
		+ " be downloaded from the server."
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
