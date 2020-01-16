/**
 * Utilities used in Rose CLI
 *
 * @author Asuman Suenbuel
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const openBrowser = require('open');

const { inred, ingreen, inyellow, inmagenta, incyan } = require('../colorize');

const _output = msg => {
    let json = null;
    if (typeof msg === 'object' && Object.keys(msg).length > 0) {
	json = msg;
    } else {
	try {
	    json = JSON.parse(msg);
	} catch (err) {}
    }
    if (json) {
	if (json.error) return json.error;
	return JSON.stringify(json, null, 2);
    }
    if (typeof process.stdout.columns === 'number') {
	let columns = process.stdout.columns;
	if (msg.length >= columns) {
	    msg = formatText(msg, Math.trunc(columns * 0.8), '');
	}
    }
    return msg;
}

const cliError = errmsg => {
    let msg = _output(errmsg);
    console.error(inred(formatText(`${msg}`, 80, '***')));
    //console.error(errmsg);
}

const cliInfo = (msg, nonewline) => {
    let out = _output(msg);
    if (!nonewline) {
	out += '\n';
    }
    process.stdout.write(out);
}

const cliWarn = msg => console.log(_output(inyellow(msg)));

const cliStartProgress = () => {
    const timer = setInterval(() => cliInfo('.', true, true), 1000);
    return timer;
}

const cliStopProgress = timer => {
    try {
	clearTimeout(timer);
    } catch (err) {}
}

/**
 * invoke the system text editor (vi or $EDITOR) on the given filename
 * @param {string} filename
 * @param {function} callback - the callback function is called as
 * follows after the system editor is terminated:
 *
 *   callback(newFileContents, hasChanged)
*/
const editFile = (filename, callback) => {
    var contentBefore = '';
    if (fs.existsSync(filename)) {
	contentBefore = fs.readFileSync(filename, 'utf-8');
    }
    const child_process = require('child_process');
    var editor = process.env.EDITOR || 'vi';

    var eparts = editor.split(/\s+/);
    editor = eparts.shift()
    
    var child = child_process.spawn(editor, [...eparts, filename], {
	stdio: 'inherit'
    });

    child.on('exit', function (e, code) {
	//console.log("finished");
	var contentAfter = '';
	if (fs.existsSync(filename)) {
	    contentAfter = fs.readFileSync(filename, 'utf-8');
	}
	const hasChanged = contentBefore !== contentAfter;
	if (typeof callback === 'function') {
	    callback(contentAfter, hasChanged);
	}
    });
};

const editString = (string, suffix, callback) => {
    const fname = path.join(os.tmpdir(),`rose-cli-edit-${process.ppid}.${suffix}`);
    fs.writeFileSync(fname, string);
    editFile(fname, callback);
}

const getUniqueNameListAndHash = records => {
    const nameHash = {}
    const uniqueNameList = [];
    const hash = {}
    records.forEach(obj => {
	const { NAME, UUID } = obj;
	if (typeof nameHash[NAME] !== 'number') {
	    nameHash[NAME] = -1;
	}
	nameHash[NAME]++;
	const cnt = nameHash[NAME];
	const uniqueName = NAME + (cnt > 0 ? ` (${UUID})` : '');
	uniqueNameList.push(uniqueName);
	hash[uniqueName] = obj;
    });
    return { uniqueNameList, hash };
}

const findAllFiles = (fname, dir) => {
    const res = {};
    const _find = dir => {
	try {
	    const subdirs = [];
	    const files = fs.readdirSync(dir);
	    let fileFound = false;
	    files.forEach(filename => {
		const fullName = path.join(dir, filename);
		if (fs.lstatSync(fullName).isDirectory()) {
		    //console.log(` directory ${fullName}`);
		    subdirs.push(fullName);
		} else {
		    if (filename === fname) {
			fileFound = true;
			try {
			    let content = {};
			    try {
				content = fs.readFileSync(fullName, 'utf-8');
				content = JSON.parse(content);
			    } catch (err) {}
			    const key = path.resolve(dir);
			    res[key] = content;
			} catch (err) {
			    console.error(err);
			}
		    }
		}
	    });
	    if (!fileFound) {
		subdirs.forEach(_find);
	    }
	} catch (err) {
	    console.error(err);
	}
    }
    _find(dir);
    //console.log(res);
    return res;
}

const stringIsUuid = str => {
    if (typeof str !== 'string') return false;
    let s = str.toLowerCase();
    return s.replace(/[0-9a-f]/g,'') === '----';
}

const allFilenamesInFolder = folder => {
    if (!fs.lstatSync(folder).isDirectory()) {
	return [];
    }
    return fs.readdirSync(folder);
}

const isValidFilename = (fname, isPath = false) => {
    const regex = new RegExp(/[<>/\\\/\[\]\{\}#\|&:\(\)"']/);
    if (isPath) {
	fname = path.basename(fname);
    }
    return !fname.match(regex);
}

const isRelativeToFolder = (fname, folder = '.') => {
    let rpath = path.relative(fs.realpathSync(folder), fname);
    let p1 = rpath.split(path.sep)[0];
    return p1 !== '..';
}

const stringFormat = (str, ...args) => {
    for (k in args) {
	str = str.replace("{" + k + "}", args[k])
    }
    return str
};

const formatText = (text, lineLength = 80, indent = '') => {
    const words = text.split(/\s+/);
    const lines = [];
    var currentLine = [indent];
    words.forEach(word => {
	let wlen = word.length;
	let llen = currentLine.join(" ").length;
	if (llen + wlen > lineLength) {
	    lines.push(currentLine);
	    currentLine = [indent];
	}
	currentLine.push(word);
    });
    if (currentLine.length > 0) {
	lines.push(currentLine);
    }
    const longestLineLength = lines.reduce((max, line) => Math.max(line.join(' ').length, max), -1);
    //console.log(`longest line length: ${longestLineLength}`);
    if (false) {
	const formattedLines = lines.map(words => {
	    if (words.join(" ").length < longestLineLength * 0.8) {
		return
	    }
	    while (words.join(' ').length < longestLineLength) {
		let index = Math.trunc(Math.random() * (words.length - 1)) + 1;
		words.splice(index,0,'');
	    }
	});
    }
    const formattedText = lines.map(words => words.join(' ').trim()).join('\n');
    return formattedText;
}

const openUrlInBrowser = (url, wait = false, callback = (() => 0)) => {
    openBrowser(url, { wait }).then(callback);
};

const getTmpFile = (prefix = "rose", suffix="") => {
    return path.join(os.tmpdir(),`${prefix}-${process.ppid}${suffix}`);
}
    
module.exports = {
    cliError,
    cliInfo,
    cliWarn,
    cliStartProgress,
    cliStopProgress,
    editFile,
    editString,
    getUniqueNameListAndHash,
    findAllFiles,
    stringIsUuid,
    allFilenamesInFolder,
    isValidFilename,
    isRelativeToFolder,
    stringFormat,
    formatText,
    openUrlInBrowser,
    getTmpFile
}
