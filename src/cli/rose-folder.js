/**
 * Command line interface - folder related actions
 *
 * @author Asuman Suenbuel
 */

const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');

const { cliInfo, cliWarn, cliError, getUniqueNameListAndHash,
	findAllFiles, stringIsUuid, allFilenamesInFolder,
	cliStartProgress, cliStopProgress, isValidFilename,
	isRelativeToFolder, stringFormat, runSystemCommand } = require('./cli-utils');
const { mkdirRecursiveSync } = require('../server_utils');

const { messages } = require('./help-texts');

const { blue, red, green, yellow, bold, dim } = require('chalk');

const { CLI } = require('../config');

const roseInitFilename = CLI.RoseInitFilename;

const roseInstallScriptFilename = CLI.RoseInstallFilename;

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
	//console.log('finding all rose init files...');
    }

    get $info() {
	let info = findAllFiles(roseInitFilename, this.folderName);
	//this._enhanceInfo(info);
	return info;
    }

    getInitFileInFolder(folder) {
	return path.join(folder, roseInitFilename);
    }

    getInstallScriptInFolder(folder) {
	return path.join(folder, roseInstallScriptFilename);
    }

    get info() {
	return this.$info;
    }

    get infoByUuid() {
	const uuidHash = {};
	Object.keys(this.$info).forEach(folder => {
	    const finfo = this.$info[folder];
	    try {
		const uuid = finfo.object.UUID;
		const obj = { folder };
		Object.keys(finfo).forEach(key => {
		    obj[key] = finfo[key];
		});
		uuidHash[uuid] = obj;
	    } catch (err) {
	    }
	});
	return uuidHash
    }

    /**
     * add more information to the $info object
     * - class folders get list of their instance folders
     * - instances get entry for class folder
     */
    _enhanceInfo(info) {
	const instances = {};
	const infoByUuid = this.infoByUuid;
	Object.keys(info).forEach(folder => {
	});
    }

    _selectFromExisting(questionText, entityName, queryTerm, options) {
	let type = 'rawlist';
	let name = 'result';
	let message = questionText;
	let { filter } = options;
	return new Promise((resolve, reject) => {
	    this.rose.findEntities(entityName, queryTerm, (err, records) => {
		if (err) return reject(err);
		let ffun = (typeof filter === 'function') ? filter : (() => true)
		let frecords = records.filter(ffun);
		if (frecords.length === 0) {
		    return resolve(null);
		}
		let { uniqueNameList, hash } = getUniqueNameListAndHash(frecords);
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
			    folderExists = true;
			    //throw `directory "${folder}" exists and is not empty.`;
			    let type = 'confirm',
				name = 'ok',
				message = stringFormat(messages.confirmOverwriteScenarioFolder, true, '  ', folder);
			    let question = { type, name, message };
			    return inquirer
				.prompt(question)
				.then(({ ok }) => {
				    if (ok) {
					//console.log(`continuing...`);
					return folder;
				    }
				    throw "operation aborted.";
				})
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

    _processFolderArgumentToInitScenario(folder) {
	//cliWarn(`processing folder argument ${folder}...`)
	if (!folder) {
	    // no folder argument passed to init-scenario
	    return Promise.resolve(null);
	}
	const _process = () => {
	    const finfo = this.getFolderInfo(folder);
	    if (finfo && finfo.object) {
		//let msg = `Folder "${folder}" is already connected to a RoseStudio scenario.`;
		//return Promise.reject(msg);
		let type = 'confirm',
		    name = 'ok',
		    message = stringFormat(messages.confirmOverwriteScenarioFolderArgument, true, '  ', folder, finfo.object.NAME);
		let question = { type, name, message };
		return inquirer
		    .prompt(question)
		    .then(({ ok }) => {
			if (ok) {
			    let folderObject = finfo.object;
			    return { folder, folderObject };
			}
			throw "operation aborted";
		    })
	    }
	    if (!isValidFilename(folder, true)) {
		let msg = `"${folder}" contains invalid characters for a folder.`;
		return Promise.reject(msg);
	    }
	    if (!isRelativeToFolder(folder, '.')) {
		let msg = `folder "${folder}" is not in the current working directory tree; `
		    + `only folders under the current working directory can be used here.`;
		return Promise.reject(msg);
	    }
	    if (fs.existsSync(folder)) {
		//console.log(`${folder} exists.`);
		if (!fs.lstatSync(folder).isDirectory()) {
		    let msg = `"${folder}" exists and is not a directory.`
		    return Promise.reject(msg);
		}
		return Promise.resolve(folder);
	    } else {
		let type = 'confirm',
		    name = 'okToCreate',
		    message = `Folder "${folder}" doesn't exist; do you want to create it?`;
		return inquirer
		    .prompt({ type, name, message })
		    .then(({okToCreate}) => {
			if (!okToCreate) {
			    return Promise.reject('folder not created, exiting...');
			}
			cliInfo(`creating folder "${folder}"...`, true);
			try {
			    mkdirRecursiveSync(folder);
			    cliInfo('done.');
			} catch (err) {
			    cliInfo('');
			    let msg = `Something went wrong trying to create the folder: ${err}`;
			    return Promise.reject(msg);
			}
			return { folder };
		    });
	    }
	}
	
	try {
	    return _process();
	} catch (err) {
	    return Promise.reject(err);
	}
	//return Promise.resolve(folder);
    }

    _writeFolderInfo(folder, isClass, object, lastUploadTimestamp) {
	const initFile = this.getInitFileInFolder(folder);
	const json = { isClass, object };
	if (typeof lastUploadTimestamp === 'number') {
	    json.lastUploadTimestamp = lastUploadTimestamp;
	}
	fs.writeFileSync(initFile, JSON.stringify(json), 'utf-8');
    }

    _disconnectFolder(folder) {
	const initFile = this.getInitFileInFolder(folder);
	try {
	    fs.unlinkSync(initFile);
	} catch (err) {
	}
    }

    /**
     * updates the folder info stored for the given folder by
     * contacting the Rose server for any updated information. Returns
     * a Promise.
     */
    _updateFolderInfo(folder, options = {}) {
	const { okIfDisconnected, check } = options;
	if (!check) {
	    return Promise.resolve({});
	}
	const finfo = this.getFolderInfo(folder)
	if (!finfo || !finfo.object) {
	    console.log(`no rose information found for folder "${folder}"`);
	    return Promise.resolve({})
	}
	cliInfo(dim(`  checking for updated folder info for "${folder}"...`), true);
	const ptimer = cliStopProgress();
	const obj = finfo.object;
	return new Promise((resolve, reject) => {
	    this.rose.getConnection(obj.UUID, (err, cobj) => {
		cliStopProgress(ptimer);
		cliInfo('');
		if (this._maybeDisconnectFolder(err, folder)) {
		    if (okIfDisconnected) {
			return resolve(folder);
		    }
		    return reject(`folder is no longer connected to Rose.`);
		}
		if (err) {
		    return reject(err);
		}
		let changeDetected = this._maybeUpdateFolderInfo(folder, obj, cobj);
		resolve(changeDetected);
	    });
	});
    }

    /**
     * checks whether certain key fields have changed and updated the folder info
     */
    _maybeUpdateFolderInfo(folder, oldObject, newObject) {
	const fields = ['NAME', 'ISLOCAL', 'CLASS_UUID'];
	let changeDetected = false;
	for(let i = 0; i < fields.length && !changeDetected; i++) {
	    let fld = fields[i];
	    let oldVal = oldObject[fld];
	    let newVal = newObject[fld];
	    if (oldVal !== newVal) {
		cliInfo(dim(`  [${folder}]: value of field "${fld}" has changed.`));
		changeDetected = true;
	    }
	}
	if (changeDetected) {
	    let object = newObject;
	    let isClass = !newObject.CLASS_UUID;
	    this._writeFolderInfo(folder, isClass, object);
	    cliInfo(dim(`  folder "${folder}" updated locally.`));
	}
	return changeDetected;
    }

    _maybeDisconnectFolder(err, folder) {
	if (err) {
	    if (typeof err === 'string' && err.includes('no record found with id')) {
		let finfo = this.getFolderInfo(folder);
		let folderName = this. getFolderNameFromFolderKey(folder);
		const classOrInstance = finfo.isClass ? 'class' : 'instance';
		let oldName = finfo.object.NAME;
		this._disconnectFolder(folder);
		cliInfo(`folder "${folderName}" has been disconnected; scenario`
			+ ` "${oldName}" could no longer be found on the server.`);
		return true;
	    }
	}
	return false;
    }

    getFolderInfo(folder) {
	let infoKey = this.getFolderInfoKey(folder); //path.resolve(folder);
	return this.$info[infoKey];
    }

    getFolderInfoKey(folder) {
	return path.resolve(folder);
    }

    getAllInstanceFolderKeys(folderOrUuid) {
	let uuid;
	let folder;
	if (stringIsUuid(folderOrUuid)) {
	    uuid = folderOrUuid;
	} else {
	    folder = folderOrUuid;
	    const finfo = this.getFolderInfo(folder);
	    if (!finfo || !finfo.object) {
		cliError(`folder "${folder}" doesn't seem to be connected to any RoseStudio scenario.`);
		return;
	    }
	    uuid = finfo.object.UUID;
	}
	const instances = [];
	Object.keys(this.$info).forEach(key => {
	    let finfo = this.$info[key];
	    try {
		let classUuid = finfo.object.CLASS_UUID;
		if (classUuid === uuid) {
		    instances.push(key);
		}
	    } catch (err) {}
	});
	return instances;
    }

    getFolderNameFromFolderKey(fullpath) {
	if (typeof fullpath !== 'string') {
	    return null;
	}
	return path.relative(fs.realpathSync('.'), fullpath);
    }

    getAllInstanceFolders(folderOrUuid) {
	return this.getAllInstanceFolderKeys(folderOrUuid)
	    .map(key => this.getFolderNameFromFolderKey(key))
    }

    getClassFolderKey(instanceFolder) {
	const finfo = this.getFolderInfo(instanceFolder);
	if (!finfo || !finfo.object) {
	    cliError(`folder "${folder}" doesn't seem to be connected to any RoseStudio scenario.`);
	    return;
	}
	const classUuid = finfo.object.CLASS_UUID;
	if (!classUuid) {
	    return null;
	}
	let classFolderKey = null;
	Object.keys(this.$info).forEach(key => {
	    if (classFolderKey) {
		return;
	    }
	    let finfo = this.$info[key];
	    try {
		let uuid = finfo.object.UUID;
		if (classUuid === uuid) {
		    classFolderKey = key;
		}
	    } catch (err) {}
	});
	return classFolderKey;
    }

    /**
     * returns a hash with keys being the keys of the class folders
     * into the info object mapped to the UUID of the corresponding
     * scenarion class
     */
    getAllClassKeysAndUuids() {
	const classKeyUuidMap = {};
	Object.keys(this.info).forEach(key => {
	    let finfo = this.info[key];
	    if (finfo && finfo.object && (!finfo.object.CLASS_UUID)) {
		let uuid = finfo.object.UUID;
		classKeyUuidMap[key] = uuid;
	    }
	});
	return classKeyUuidMap;
    }

    // --------------------------------------------------------------------------------

    /**
     * goes through all registered local folders and checks whether
     * the connected Rose object still exists on the server. If not,
     * the folder is disconnect, i.e. the roseInitFile is deleted. The
     * folder content itself is not touched (beside removing the
     * roseInitFile).
     */
    cleanup(options = {}) {
	const info = this.$info;
	const promises = Object.keys(info).map(folder => {
	    return this.cleanupFolder(folder);
	});
	return Promise.all(promises).catch(cliError);
    }

    /**
     * checks whether the Rose object that is connected with this
     * folder still exists on the server. If not, the folder is
     * disconnect, i.e. the roseInitFile is deleted. The folder
     * content itself is not touched (beside removing the
     * roseInitFile).
     * @param {string} folder
     * @returns {Promise}
     */
    cleanupFolder(folder) {
	const finfo = this.getFolderInfo(folder);
	if (!finfo || !finfo.object) {
	    return Promise.resolve(null);
	}
	let folderName = this. getFolderNameFromFolderKey(folder);
	return new Promise((resolve, reject) => {
	    const uuid = finfo.object.UUID;
	    const classOrInstance = !!finfo.object.CLASS_UUID ? 'instance' : 'class';
	    cliInfo(dim(`- checking ${classOrInstance} folder "${folderName}"...`));
	    this.rose.getConnection(uuid, (err, obj) => {
		if (this._maybeDisconnectFolder(err, folder)) {
		    return resolve(folder);
		}
		if (err) {
		    return reject(err);
		}
		let changeDetected = this._maybeUpdateFolderInfo(folder, finfo.object, obj);
		if (changeDetected) {
		    return resolve(folder);
		}
		resolve(null);
	    });
	});
    }
    
    // --------------------------------------------------------------------------------

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
	    const { message, fieldName, defaultValue, fieldType, validate, filter } = pobj;
	    const question = { type: 'input', message, name: fieldName, validate, filter };
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

    initScenarioInteractively(folder, options = {}) {
	const { create } = options;

	const _getExistingConnectionsFromRoseServer = () => {
	    cliInfo(`retrieving information from Rose server...`, true);
	    const ptimer = cliStartProgress();
	    return new Promise((resolve, reject) => {
		this.rose.getConnections((err, records) => {
		    cliStopProgress(ptimer);
		    cliInfo('');
		    if (err) {
			return reject(err);
		    }
		    resolve(records);
		});
	    })
	}
	
	const _inquireCreateOrInit = () => {
	    let type = 'rawlist';
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
	let folderParameter = null;
	let existingFolderObject = null;
	let existingConnectionObjects = [];
	let existingConnectionNames = []
	_getExistingConnectionsFromRoseServer()
	    .then(cobjs => {
		if (cobjs && Array.isArray(cobjs)) {
		    existingConnectionObjects = cobjs;
		    existingConnectionNames = cobjs.map(cobj => cobj.NAME);
		}
		//console.log(`existing names: ${existingConnectionNames.sort().join('\n')}`)
		return this._processFolderArgumentToInitScenario(folder)
	    })
	    .then(folderAndObject => {
		let fld = folderAndObject.folder;
		let folderObject = folderAndObject.folderObject;
		existingFolderObject = folderObject;
		if (fld) {
		    folderParameter = fld;
		    if (folderObject && folderObject.UUID) {
			return Promise.resolve("I");
		    }
		    return Promise.resolve("C");
		}
		if (options.create) {
		    return Promise.resolve("C");
		}
		return _inquireCreateOrInit()
	    })
	    .then(answer => {
		if (answer === "I") {
		    let connectionObject;
		    let infoByUuid = this.infoByUuid;
		    (existingFolderObject
		     ? Promise.resolve(existingFolderObject)
		     : this._selectFromExisting('Select an existing scenario class',
						'connections',
						{ CLASS_UUID: '$isnull' },
						{
						    filter: cobj => {
							let uuid = cobj.UUID;
							let isLocal = !!cobj.ISLOCAL;
							if (uuid in infoByUuid) {
							    //console.log(`already connected: scenario class ${cobj.NAME}...`);
							    return false;
							}
							if (isLocal) {
							    return false;
							}
							return true;
						    }
						})
		    )
			.then(connObj => {
			    if (!connObj) {
				cliInfo('no scenario classes found that can be connected to a local folder; '
					+ 'that usually means that all scenarios on the Rose server '
					+ 'that you have access to are already connected to local folder(s).');
				return Promise.resolve(null);
			    }
			    connectionObject = connObj;
			    let msg = 'Please enter a folder name for the code files';
			    if (folderParameter) {
				return Promise.resolve(folderParameter);
			    } else {
				return this._getCleanFolderName(msg, connObj.NAME);
			    }
			})
			.then(folder => {
			    if (!folder) return Promise.resolve(null);
			    let hasCodeOnServer = this.rose.hasCodeOnServer(connectionObject);
			    if (hasCodeOnServer) {
				cliInfo(`downloading code from RoseStudio into `
					+ `folder "${folder}"...`, true);
			    } else {
				cliInfo(`download skipped; scenario has no code on RoseStudio server.`);
			    }
			    const _download = () => {
				const ptimer = cliStartProgress();
				const uuid = connectionObject.UUID;
				return new Promise((resolve, reject) => {
				    this.rose.downloadCode(uuid, folder, (err, result) => {
					cliStopProgress(ptimer);
					if (err) return reject(err);
					cliInfo('done.');
					resolve(folder);
				    });
				});
			    };
			    return hasCodeOnServer ? _download() : Promise.resolve(folder);
			})
			.then(folder => {
			    if (!folder) return Promise.resolve(null);
			    return new Promise((resolve, reject) => {
				try {
				    const isClass = true;
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
		    let ISLOCAL = 1;
		    let localFolder;
		    (folderParameter
		     ? Promise.resolve(folderParameter)
		     : this._selectExistingFolder('Please select the root folder that contains '
						+ 'your source code (template)'))
			.then(folder => {
			//console.log(`local folder: ${folder}`);
			localFolder = folder;
			const prompts = [
			    { message: "Name of the new scenario class in Rose Studio:",
			      fieldName: 'NAME',
			      defaultValue: path.basename(folder),
			      validate: name => {
				  if (existingConnectionNames.includes(name)) {
				      return `a scenario with that name already exists, `
					  + `please choose a different name.`;
				  }
				  if (!isValidFilename(name)) {
				      return `this name contains invalid characters`;
				  }
				  return true;
			      },
			      filter: name => name.trim()
			    }
			];
			return this._createRoseStudioObjectInteractively('connections',
									 { ISLOCAL },
									 prompts);
		    })
			.then(newObject => {
			    //console.log(`new object created: ${JSON.stringify(newObject, null, 2)}`);
			    const { NAME, UUID } = newObject;
			    if (!UUID) {
				throw "something went wrong during the creation of the new scenario"
			    }
			    this._writeFolderInfo(localFolder, true, newObject);
			    const url = this.rose.getRoseStudioConnectionPageUrl(UUID);
			    cliInfo(`new connection object created and connected to local folder "${localFolder}"`);
			    cliInfo(`RoseStudio url: ${blue(url)}`);
			    return newObject;
			})
			.then(obj => {

			    const _upload = () => {
				const { UUID } = obj;
				if (!UUID) {
				    throw "something went wrong, UUID is missing from object"
				}
				cliInfo(`uploading source code to RoseStudio...`, true);
				const ptimer = cliStopProgress();
				return new Promise((resolve, reject) => {
				    this.rose.uploadCodeTemplate(UUID, localFolder, (err, result) => {
					cliStopProgress(ptimer);
					if (err) return reject(err);
					cliInfo('done');
					this._updateLastUploadTimestamp(localFolder);
					resolve();
				    });
				});
			    };
			    const _skipUpload = () => {
				cliInfo(`skipping upload; new scenario "${obj.NAME}" is marked as `
					+ `"local"; this setting can be changed in RoseStudio.`);
				return Promise.resolve();
			    }
			    return ISLOCAL ? _skipUpload() : _upload();
			})
			.catch(cliError)
		}
	    })
	    .catch(cliError)
    }

    /**
     * initialize and create a local subfolder to be connected to an
     * instance of the scenario class that is connected to the given
     * classFolder
     */
    initInstanceInteractively(classFolder, options = {}, debug = false) {
	
	const doInit = classObject => {
	    const { UUID, CLASS_UUID, NAME } = classObject; //folderInfo.object;
	    const scenarioClassName = NAME;
	    if (!!CLASS_UUID) {
		return showError();
	    }
	    return new Promise((resolve, reject) => {
		cliInfo('retrieving information from server...', true);
		const ptimer = cliStartProgress();
		this.rose.getAllConnectionInstances(UUID, (err, instanceObjects) => {
		    cliStopProgress(ptimer);
		    cliInfo('');
		    if (err) {
			return reject(err);
		    }
		    const infoByUuid = this.infoByUuid;
		    const totalInstanceCount = instanceObjects.length;
		    const existingInstancesNames = instanceObjects.map(({ NAME }) => NAME);
		    debug && console.log(`found ${instanceObjects.length} instances`);
		    const iobjs = instanceObjects.filter(({ UUID }) => {
			return !(UUID in infoByUuid);
		    });
		    const adjustedInstanceCount = iobjs.length;
		    debug && console.log(`${iobjs.length} left after excluding the ones `
					 + `already connected to local folders`);
		    if (adjustedInstanceCount === 0) {
			let msg;
			if (totalInstanceCount === 0) {
			    msg = `Scenario class "${scenarioClassName}" has no instances.`;
			} else {
			    msg = `All instances of scenario class "${scenarioClassName}" are already `
				+ `connected to local folders`;
			}
			!options.create && cliInfo(msg);
			return (options.create
				? Promise.resolve({ result: true })
				: inquirer
				.prompt({
				    type: 'confirm',
				    name: 'result',
				    message: 'Do you want to create a new instance?',
				    'default': true
				}))
			    .then(({ result }) => {
				if (result) {
				    //console.log(`classFolder: ${classFolder}`);
				    return this.createNewInstanceInteractively({
					classUuid: UUID,
					className: scenarioClassName,
					existingInstancesNames,
					classFolder
				    });
				} else {
				    return null;
				}
			    })
			    .then(folder => {
				resolve(folder);
			    })
			    .catch(reject)
		    } else {
			let type = 'rawlist',
			    name = 'result',
			    message = 'Do you want to ...',
			    choices = ['Create a new instance', 'Connect to an existing instance'];
			(options.create
			 ? Promise.resolve({ result: "Create" })
			 : inquirer
			 .prompt({ type, name, message, choices, 'default': 0 }))
			    .then(({ result }) => {
				if (result.startsWith('Create')) {
				    return this.createNewInstanceInteractively({
					classUuid: UUID,
					className: scenarioClassName,
					existingInstancesNames,
					classFolder
				    });
				} else {
				    // connect to an existing instance
				    let type = 'rawlist',
					message = 'Select from the list:',
					name = 'iobj',
					choices = iobjs.map(iobj => ({ name: iobj.NAME, value: iobj }));
				    return inquirer
					.prompt({
					    type,
					    name,
					    message,
					    choices
					})
					.then(({ iobj }) => {
					    return this.connectObjectToFolderInteractively(iobj)
						.catch(reject);
					})
					.catch(reject)
				}
			    })
			    .then(folder => {
				//console.log(`FOLDER: ${JSON.stringify(folder, null, 2)}`)
				resolve(folder);
			    })
			    .catch(reject)
			return;
		    }
		});
	    })
	}

	if (stringIsUuid(classFolder)) {
	    let uuid = classFolder
	    this.rose.getConnection(uuid, (err, classObject) => {
		if (err) {
		    return cliError(err);
		}
		doInit(classObject);
	    });
	    return;
	}
	const folderInfo = this.getFolderInfo(classFolder);
	//console.log(`folderInfo: ${JSON.stringify(folderInfo)}`);
	const showError = () => {
	    cliError(`${classFolder} is not connected to a RoseStudio scenario class. `
		     + `Please use "rose info" for more information about local folders `
		     + `connected to RoseStudio objects.`);
	};
	if (typeof folderInfo !== 'object') {
	    return showError();
	}
	doInit(folderInfo.object)
	    .then(folder => {
		//console.log(`folder returned by doInit: ${folder}`);
		if (!folder) {
		    return;
		}
		try {
		    let instanceFolderInfo = this.getFolderInfo(folder);
		    let uuid = instanceFolderInfo.object.UUID;
		    let url = this.rose.getRoseStudioConnectionPageUrl(uuid);
		    cliInfo(`Rose Studio Url: ${blue(url)}`);
		} catch (err) {}
		let type = 'confirm',
		    name = 'doUpdate',
		    message = 'Do you want to download the instance code now?',
		    defaultValue = true;
		return inquirer
		    .prompt({
			type,
			name,
			message,
			'default': defaultValue
		    })
		    .then(({ doUpdate }) => {
			if (doUpdate) {
			    let updateOptions = { classUpdate: false, internalCall: true };
			    return this.updateInstanceFolder(folder, updateOptions).catch(cliError);
			} else {
			    let msg = `You can always run "rose update ${folder}" to download `
				+ `the updated instance code.`;
			    cliInfo(msg);
			}
		    });
	    })
    }

    _getValidNameForNewInstance(options) {
	const { classUuid, className, existingInstancesNames, classFolder } = options;
	/*
	if (Array.isArray(existingInstancesNames) && existingInstancesNames.length > 0) {
	    cliInfo(`Names of existing instances for scenario class "${className}":`);
	    existingInstancesNames.forEach(name => {
		cliInfo(`- "${name}"`);
	    });
	}
	*/
	const type = 'input';
	const name = 'result';
	const message = `Enter a name for the new instance of scenario "${className}":`;
	const defaultValue = null;
	const _validate = (name) => {
	    let tname = name.trim();
	    if (tname.length === 0) {
		return "name can't be empty";
	    }
	    if (Array.isArray(existingInstancesNames)) {
		if (existingInstancesNames.includes(tname)) {
		    return "an instance with that name already exists; "
			+ `use "rose init-instance ${classFolder}" and select `
			+ `"Connect to an existing instance".`;
		}
	    }
	    return true;
	};
	return inquirer
	    .prompt({
		type,
		name,
		message,
		'default': defaultValue,
		validate: _validate
	    })
	    .then(({ result }) => {
		const iname = result.trim();
		return iname;
	    })
	    .catch(cliError)
    }

    
    createNewInstanceInteractively(options) {
	const { classUuid, className, classFolder } = options;
	return this._getValidNameForNewInstance(options)
	    .then(iname => {
		cliInfo(`creating new instance named "${iname}"...`);
		return new Promise((resolve, reject) => {
		    this.rose.createInstance(classUuid, iname, (err, instanceObject) => {
			if (err) {
			    return reject(err);
			}
			resolve(instanceObject);
		    });
		});
	    })
	    .then(iobj => {
		//console.log(`new instance object: ${JSON.stringify(iobj, null, 2)}`);
		return iobj;
	    })
	    .then(iobj => {
		return this.connectObjectToFolderInteractively(iobj);
	    })
	    .catch(cliError)
    }

    connectObjectToFolderInteractively(object) {
	const instanceName = object.NAME;
	const message = 'Enter the name of the (new) folder for the instance (will be created):';
	const defaultValue = instanceName;
	return this._getCleanFolderName(message, defaultValue)
	    .then(folder => {
		if (folder) {
		    //console.log(`instance folder: ${folder}`)
		    this._writeFolderInfo(folder, false, object);
		} else {
		    throw "can't continue"
		}
		return folder;
	    })
	    .catch(err => cliError(err))
    }

    updateScenarioFolder(folder, options = {}, internalOptions = {}) {
	let updateFolderPromise;
	if (internalOptions.internalCall) {
	    updateFolderPromise = Promise.resolve(false);
	} else {
	    updateFolderPromise = this._updateFolderInfo(folder, options);
	}
	return updateFolderPromise
	    .then(hasChanged => {
		return this._updateScenarioFolder(folder, options, internalOptions);
	    })
	    .catch(cliError)
    }
    
    _updateScenarioFolder(folder, options = {}, internalOptions = {}) {
	const finfo = this.getFolderInfo(folder);
	//console.log(blue(`instanceFolders in updateScenario: ${JSON.stringify(internalOptions.instanceFolders)}`))
	const errmsgNoInfo = `no rose information found for "${folder}"; `
	      + 'please specify a folder that is connected to a RoseStudio scenario class.';
	if (!finfo) {
	    return cliError(errmsgNoInfo);
	}
	if (!finfo.object && !finfo.object.UUID) {
	    return cliError(errmsgNoInfo);
	}
	const uuid = finfo.object.UUID;
	const isLocal = finfo.object.UUID;
	if (finfo.object.CLASS_UUID) {
	    let msg = `Folder "${folder}" doesn't seem to be connected to a scenarion class; `
		+ 'please specify a folder that is connected to an RoseStudio scenario class.';
	    return cliError(msg);
	}
	cliInfo(`  uploading to scenario "${finfo.object.NAME}"...`, true);

	const _updateInstances = (uuid, localFilesOnly) => {
	    let { instanceFolders } = internalOptions;
	    let ifolders = (instanceFolders && instanceFolders.slice())|| this.getAllInstanceFolders(uuid);
	    if (!Array.isArray(instanceFolders)) instanceFolders = [instanceFolders]
	    if (ifolders.length === 0) {
		cliInfo('found no local instance folders for this scenario class.');
		return;
	    }
	    if (!internalOptions.instanceFolders) {
		cliInfo(dim(`  - instance folders \"${ifolders.join("\", \"")}\"`));
	    }
	    const updateNextInstanceFolder = () => {
		if (ifolders.length === 0) {
		    return;
		}
		let ifolder = ifolders.shift();
		options.classUpdate = false;
		options.internalCall = true;
		internalOptions.localFilesOnly = localFilesOnly;
		return this.updateInstanceFolder(ifolder, options, internalOptions)
		    .then(() => {
			updateNextInstanceFolder();
		    })
		    .catch(cliError)
	    }
	    return updateNextInstanceFolder();
	};

	if (options.instancesOnly) {
	    cliInfo(`  option "--instances-only" has been specified, skipping scenario class upload.`);
	    return _updateInstances(uuid);
	}
	
	const ptimer = cliStartProgress();
	return new Promise((resolve, reject) => {
	    let { lastUploadTimestamp } = finfo;
	    //if (options.force) console.log(blue(`  - OPTION FORCE DETECTED`));
	    let uploadOptions = options.force ? { force: options.force } : { lastUploadTimestamp };
	    this.rose.uploadCodeTemplate(uuid, folder, uploadOptions, (err, filesAdded) => {
		cliStopProgress(ptimer);
		if (err) {
		    return reject(err);
		}
		if (filesAdded.length > 0) {
		    let flen = filesAdded.length;
		    cliInfo(`uploaded ${flen} file${flen===1?'':'s'}.`);
		    cliInfo('  ' + filesAdded.map(f => dim(`- ${f}`)).join('\n  '));
		    this._updateLastUploadTimestamp(folder);
		} else {
		    cliInfo(`no files needed to be uploaded to RoseStudio.`);
		}
		if (!internalOptions.instanceFolders && !options.all) {
		    cliInfo(`instance folders not updated; specify "--all" options to`
			    + ` automatically update all instance folders.`);
		    return;
		}
		let localFilesOnly = (filesAdded.length === 0);
		return _updateInstances(uuid, localFilesOnly)
		    .then(() => {
			resolve();
		    })
		    .catch(cliError)
	    });
	});
    }

    _updateLastUploadTimestamp(folder) {
	//console.log(blue(`  - updating lastUploadTimestamp for ${folder}...`));
	const finfo = this.getFolderInfo(folder);
	if (!finfo) {
	    return;
	}
	let { isClass, object } = finfo;
	let lastUploadTimestamp = Number(new Date());
	this._writeFolderInfo(folder, isClass, object, lastUploadTimestamp);
    }

    updateInstanceFolder(folder, options = {}, internalOptions = {}) {
	let updateFolderPromise;
	let { instanceFolders } = internalOptions;
	//console.log(blue(`instanceFolders in updateInstance: ${JSON.stringify(instanceFolders)}`))
	if (internalOptions.internalCall
	    || (Array.isArray(instanceFolders) && instanceFolders.includes(folder))) {
	    updateFolderPromise = Promise.resolve(false);
	    //console.log(blue(`skipping checking for updates for ${folder}...`));
	} else {
	    updateFolderPromise = this._updateFolderInfo(folder, options);
	}
	return updateFolderPromise
	    .then(hasChanged => {
		return this._updateInstanceFolder(folder, options, internalOptions);
	    })
	    .catch(cliError);
    }
    
    _updateInstanceFolder(folder, options = {}, internalOptions = {}) {
	const { classUpdate, internalCall, wipe, skipConfirm, force } = options;
	const finfo = this.getFolderInfo(folder);
	const errmsgNoInfo = `no rose information found for "${folder}"; `
	      + 'please specify a folder that is connected to a RoseStudio scenario instance.';
	if (!finfo) {
	    return cliError(errmsgNoInfo);
	}
	if (!finfo.object && !finfo.object.UUID) {
	    return cliError(errmsgNoInfo);
	}
	const uuid = finfo.object.UUID;
	const instanceName = finfo.object.NAME;
	const classUuid = finfo.object.CLASS_UUID;
	const isLocal = !!finfo.object.ISLOCAL;
	if (!classUuid) {
	    let msg = `Folder "${folder}" doesn't seem to be connected to a scenarion instance; `
		+ 'please specify a folder that is connected to an RoseStudio scenario instance.';
	    return cliError(msg);
	}
	if (isLocal && !options.classUpdate && !internalCall) {
	    //let msg = `scenario instance "${instanceName}" is marked as "local"; `
		//+ `--no-class-update can't be used here.`;
	    //return cliError(msg);
	}
	const classFolderKey = this.getClassFolderKey(folder);
	const classFolder = this.getFolderNameFromFolderKey(classFolderKey)
	if (options.classUpdate) {
	    if (!classFolderKey) {
		cliInfo(`no scenario class found in local folder; downloading just the instance`
			+ ` code from the RoseStudio server.`);
	    } else {
		const internalOptions = { uuid: classUuid, instanceFolders: [folder] }
		cliInfo(`  updating scenario class folder "${classFolder}"...`);
		let soptions = { force, wipe, skipConfirm };
		return this.updateScenarioFolder(classFolder, soptions, internalOptions);
	    }
	}
	let sourceFolderInfo = null;
	if (isLocal) {
	    if (classFolderKey) {
		let classInfo = this.getFolderInfo(classFolder);
		//console.log(classInfo);
		sourceFolderInfo = {
		    folder: classFolder,
		    uuid: classInfo.object ? classInfo.object.UUID : null
		};
	    } else {
		let msg = `scenario class for instance "${instanceName}" cannot be found in local`
		    + ` folder tree; a folder connected to the instance's scenario class is required`
		    + ` to be present for scenarios marked as "local"`;
		return cliError(msg);
	    }
	}
	let confirmPromise = Promise.resolve({ ok: true });
	//console.log(`found instance object uuid in folder ${folder}`);
	if (!skipConfirm) {
	    let msg = wipe ? messages.confirmWipeInstanceFolder	: messages.confirmOverwriteInstanceFolder;
	    let message = stringFormat(msg, folder);
	    let type = 'confirm',
		name = 'ok';
	    let question = { type, name, message };
	    confirmPromise = inquirer.prompt(question);
	}
	return confirmPromise
	    .then(({ ok }) => {
		if (!ok) {
		    cliInfo(`ok, ${folder} has not been updated.`);
		    return Promise.resolve(false);
		} else {
		    return new Promise((resolve, reject) => {
			// disabled for now, as placeholder instantiation cannot be checked locally
			let localFilesOnly = false; //internalOptions.localFilesOnly && !wipe;
			cliInfo(`  ${localFilesOnly?'':'downloading and '}copying the code for "${folder}"...`, true);
			const ptimer = cliStartProgress();
			const deleteFilter = filename => {
			    if (filename === roseInitFilename) {
				return false;
			    }
			    return true
			};
			let options = { clearFolder: wipe, sourceFolderInfo, deleteFilter, localFilesOnly };
			this.rose.downloadCode(uuid, folder, options, (err, result) => {
			    cliStopProgress(ptimer);
			    if (err) {
				return reject(err);
			    }
			    cliInfo('done.');
			    this._checkRunInstallScript(folder);
			    resolve(true);
			});
		    })
		}
	    })
	    .catch(cliError)
    }

    /**
     * checks whether there is a .rose_install and executable file in the folder.
     * If yes, execute it.
     */
    _checkRunInstallScript(folder) {
	const finfo = this.getFolderInfo(folder);
	if (!finfo && !finfo.object) {
	    return;
	}
	const { UUID } = finfo.object.UUID;
	const installScript = this.getInstallScriptInFolder(folder);
	fs.access(installScript, fs.constants.X_OK, err => {
	    if (err) {
		//console.log(blue(`  - no executable "${roseInstallScriptFilename}" found in "${folder}"`));
		return;
	    }
	    let cmd = `echo "  executing install script in folder \"${folder}\"..."\n`
		+ `cd "${folder}" &&  exec "${path.resolve(installScript)}"\n`;
	    let cmdId = `install-${UUID}`
	    runSystemCommand(cmd, { cmdId });
	});
    }

    updateScenarioOrInstance(folder, options) {
	const finfo = this.getFolderInfo(folder);
	const errmsgNoInfo = `no rose information found for "${folder}"; `
	      + 'please specify a folder that is connected to a RoseStudio scenario instance.';
	if (!finfo) {
	    return cliError(errmsgNoInfo);
	}
	if (!finfo.object && !finfo.object.UUID) {
	    return cliError(errmsgNoInfo);
	}
	const uuid = finfo.object.UUID;
	const classUuid = finfo.object.CLASS_UUID;
	if (classUuid) {
	    return this.updateInstanceFolder(folder, options);
	} else {
	    return this.updateScenarioFolder(folder, options);
	}
    }

}

module.exports = { RoseFolder };

