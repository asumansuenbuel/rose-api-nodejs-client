/**
 * Command line interface - folder related actions
 *
 * @author Asuman Suenbuel
 */

const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');

const { cliInfo, cliWarn, cliError, getUniqueNameListAndHash, findAllFiles } = require('./cli-utils');
const { mkdirRecursiveSync } = require('../server_utils');

const roseInitFilename = '.rose';

class RoseFolder {

    constructor(rose, folderName = '.') {
	this.rose = rose;
	this.folderName = folderName;
	this._init();
    }

    _init() {
	if (!fs.lstatSync(this.folderName).isDirectory()) {
	    throw `"${this.folderName} is not a directory"`;
	}
	this.settings = {}
	console.log('finding all rose init files...');
	this.$info = findAllFiles(roseInitFilename, this.folderName);
    }

    getInitFileInFolder(folder) {
	return path.join(folder, roseInitFilename);
    }

    get info() {
	return this.$info;
    }

    _selectFromExisting(questionText, entityName, queryTerm) {
	let type = 'list';
	let name = 'result';
	let message = questionText;
	return new Promise((resolve, reject) => {
	    this.rose.findEntities(entityName, queryTerm, (err, records) => {
		if (err) return reject(err);
		let { uniqueNameList, hash } = getUniqueNameListAndHash(records);
		let choices = uniqueNameList;
		let question = { type, name, message, choices };
		inquirer
		    .prompt(question)
		    .then(answer => {
			resolve(hash[answer.result]);
		    })
		
	    });
	});
    }

    _getCleanFolderName(questionText, defaultValue, doCreateIfNotExists = true) {
	let type = 'input';
	let name = 'result';
	let message = questionText;
	let question = { type, name, message, "default": defaultValue };
	return inquirer
	    .prompt(question)
	    .then(answer => {
		return answer.result;
	    })
	    .then(folder => {
		let folderExists = false;
		if (fs.existsSync(folder)) {
		    if (fs.lstatSync(folder).isDirectory()) {
			let filesInFolder = fs.readdirSync(folder);
			if (filesInFolder.length > 0) {
			    throw `directory "${folder}" exists and is not empty.`;
			}
			folderExists = true;
		    } else {
			throw `"${folder}" exists and is not a directory`;
		    }
		}
		if (!folderExists && doCreateIfNotExists) {
		    mkdirRecursiveSync(folder);
		    cliInfo(`folder "${folder}" created.`);
		}
		return folder;
	    })
    }

    _selectExistingFolder(questionText) {
	let type = 'list';
	let name = 'result';
	let message = questionText;
	let folders = fs.readdirSync(this.folderName)
	    .filter(fname => fs.lstatSync(fname).isDirectory())
	    .filter(fname => fname !== 'node_modules')
	    .filter(fname => fname !== '.git')
	    .filter(fname => {
		let roseInitFile = path.join(fname, roseInitFilename);
		return !fs.existsSync(roseInitFile);
	    });
	let choices = folders;
	return inquirer
	    .prompt({ type, name, message, choices })
	    .then(answerObject => answerObject.result);
    }

    _writeFolderInfo(folder, isClass, object) {
	const initFile = this.getInitFileInFolder(folder);
	const json = { isClass, object };
	fs.writeFileSync(initFile, JSON.stringify(json), 'utf-8');
    }

    /**
     * creates a RoseStudio object interactively.
     * @param {string} entityName - the entity of the new object (robots, connections, ...)
     * @param {object} initialValueHash - initial values to be passed to the create call
     * @param {[object]} prompts - list of prompt definitions of the
     * form { message, fieldName, defaultValue, fieldType }
     */
    _createRoseStudioObjectInteractively(entityName, initialValueHash, prompts) {
	const questions = [];
	prompts.forEach(pobj => {
	    const { message, fieldName, defaultValue, fieldType } = pobj;
	    const question = { type: 'input', message, name: fieldName };
	    if (typeof defaultValue !== 'undefined') {
		question['default'] = defaultValue;
	    }
	    questions.push(question);
	});
	return inquirer
	    .prompt(questions)
	    .then(valueHash => {
		if (typeof initialValueHash === 'object') {
		    Object.keys(initialValueHash).forEach(key => {
		    valueHash[key] = initialValueHash[key];
		    });
		}
		return valueHash;
	    })
	    .then(valueHash => {
		return new Promise((resolve, reject) => {
		    this.rose.createEntity(entityName, valueHash, (err, newObject) => {
			if (err) return reject(err);
			resolve(newObject);
		    });
		});
	    })
    }

    initConnectionInteractively(isClass = true) {
	const _inquireCreateOrInit = () => {
	    let type = 'list';
	    let name = 'result';
	    let message = `Do you like to:`;
	    let choices = [
		new inquirer.Separator(),
		'Create a new scenario class in RoseStudio using existing code in a sub-folder',
		'Initialize an existing scenario from RoseStudio into a sub-folder',
		new inquirer.Separator()
	    ]
	    const question = { type, name, message, choices };
	    return inquirer
		.prompt(question)
		.then(answer => answer.result[0]);
	};
	_inquireCreateOrInit()
	    .then(answer => {
		if (answer === "I") {
		    let connectionObject;
		    this._selectFromExisting('Select an existing scenario class',
					     'connections',
					     { CLASS_UUID: '$isnull' })
			.then(connObj => {
			    connectionObject = connObj;
			    let msg = 'Please enter a folder name for the code files';
			    return this._getCleanFolderName(msg, connObj.NAME);
			})
			.then(folder => {
			    console.log(`downloding code from RoseStudio into `
					+ `folder "${folder}"...`);
			    const uuid = connectionObject.UUID;
			    return new Promise((resolve, reject) => {
				this.rose.downloadCode(uuid, folder, (err, result) => {
				    if (err) return reject(err);
				    cliInfo('done.');
				    resolve(folder);
				});
			    });
			})
			.then(folder => {
			    return new Promise((resolve, reject) => {
				try {
				    this._writeFolderInfo(folder, isClass, connectionObject);
				    resolve();
				} catch (err) {
				    reject(err);
				}
			    });
			})
			.catch(cliError)
		}
		else if (answer === "C") {
		    this._selectExistingFolder('Please select the root folder that contains '
					       + 'your source code (template)')
			.then(folder => {
			    console.log(`local folder: ${folder}`);
			    const prompts = [
				{ message: "Name of the new scenario class in Rose Studio:",
				  fieldName: 'NAME',
				  defaultValue: folder
				}
			    ];
			    let ISLOCAL = 1;
			    return this._createRoseStudioObjectInteractively('connections',
									     { ISLOCAL },
									     prompts);
			})
			.then(newObject => {
			    console.log(`new object created: ${JSON.stringify(newObject, null, 2)}`);
			})
			.catch(cliError)
		}
	    })
	    .catch(cliError)
    }

}

module.exports = { RoseFolder };

