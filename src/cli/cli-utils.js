/**
 * Utilities used in Rose CLI
 *
 * @author Asuman Suenbuel
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const { inred, ingreen, inyellow, inmagenta, incyan } = require('../colorize');

const _output = msg => {
    try {
	let json = JSON.parse(msg);
	if (json.error) return json.error;
	return JSON.stringify(json, null, 2);
    } catch (err) {}
    return msg;
}

const cliError = errmsg => {
    let msg = _output(errmsg);
    console.error(inred(`*** ${msg}`));
}

const cliInfo = msg => console.log(_output(msg));

const cliWarn = msg => console.log(_output(inyellow(msg)));

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

module.exports = {
    cliError,
    cliInfo,
    cliWarn,
    editFile,
    editString
}
