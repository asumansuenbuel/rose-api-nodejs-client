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
	isRelativeToFolder } = require('./cli-utils');
const { mkdirRecursiveSync } = require('../server_utils');

const { blue, red, green, yellow, bold } = require('chalk');

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

    _processFolderArgumentToInitScenario(folder) {
	//cliWarn(`processing folder argument ${folder}...`)
	if (!folder) {
	    // no folder argument passed to init-scenario
	    return Promise.resolve(null);
	}
	const _process = () => {
	    const finfo = this.getFolderInfo(folder);
	    if (finfo) {
		let msg = `Folder "${folder}" is already connected to a RoseStudio scenario.`;
		return Promise.reject(msg);
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
			return folder;
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

    _writeFolderInfo(folder, isClass, object) {
	const initFile = this.getInitFileInFolder(folder);
	const json = { isClass, object };
	fs.writeFileSync(initFile, JSON.stringify(json), 'utf-8');
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

    initScenarioInteractively(folder, options = {}) {
	const { create } = options;
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
	this._processFolderArgumentToInitScenario(folder)
	    .then(fld => {
		if (fld) {
		    folderParameter = fld;
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
		    this._selectFromExisting('Select an existing scenario class',
					     'connections',
					     { CLASS_UUID: '$isnull' })
			.then(connObj => {
			    connectionObject = connObj;
			    let msg = 'Please enter a folder name for the code files';
			    return this._getCleanFolderName(msg, connObj.NAME);
			})
			.then(folder => {
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
			      defaultValue: path.basename(folder)
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
					resolve();
				    });
				});

				const _skipUpload = () => {
				    cliInfo(`skipping upload; new scenario "${NAME}" is marked as`
					    + `"local"; this setting can be changed in RoseStudio.`);
				    return Promise.resolve();
				}
			    };
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
			cliInfo(msg);
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
				    return this.createNewInstanceInteractively({
					classUuid: UUID,
					className: scenarioClassName,
					existingInstancesNames
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
					existingInstancesNames
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
			    return this.updateInstanceFolder(folder);
			} else {
			    let msg = `You can always run "rose update ${folder}" to download `
				+ `the updated instance code.`;
			    cliInfo(msg);
			}
		    });
	    })
    }

    _getValidNameForNewInstance(options) {
	const { classUuid, className, existingInstancesNames } = options;
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
		    return "an instance with that name already exists";
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
	const { classUuid, className } = options;
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
	const message = 'Enter the name of the folder for the instance';
	const defaultValue = instanceName;
	return this._getCleanFolderName(message, defaultValue)
	    .then(folder => {
		//console.log(`instance folder: ${folder}`)
		this._writeFolderInfo(folder, false, object);
		return folder;
	    })
	    .catch(err => cliError(err))
    }

    updateScenarioFolder(folder, options = {}, internalOptions = {}) {
	const finfo = this.getFolderInfo(folder);
	const errmsgNoInfo = `no rose information found for "${folder}"; `
	      + 'please specify a folder that is connected to a RoseStudio scenario class.';
	if (!finfo) {
	    return cliError(errmsgNoInfo);
	}
	if (!finfo.object && !finfo.object.UUID) {
	    return cliError(errmsgNoInfo);
	}
	const uuid = finfo.object.UUID;
	if (finfo.object.CLASS_UUID) {
	    let msg = `Folder "${folder}" doesn't seem to be connected to a scenarion class; `
		+ 'please specify a folder that is connected to an RoseStudio scenario class.';
	    return cliError(msg);
	}
	cliInfo(`uploading contents of folder "${folder}"...`, true);
	const ptimer = cliStartProgress();
	this.rose.uploadCodeTemplate(uuid, folder, (err, result) => {
	    cliStopProgress(ptimer);
	    if (err) {
		return cliError(err);
	    }
	    cliInfo('done.');
	    if (!internalOptions.instanceFolders && !options.full) {
		cliInfo(`instance folders not updated; specify "--full" options to`
			+ ` automatically update all instance folder.`);
		return
	    }
	    let instanceFolders = internalOptions.instanceFolders || this.getAllInstanceFolders(uuid);
	    if (!Array.isArray(instanceFolders)) instanceFolders = [instanceFolders]
	    if (instanceFolders.length === 0) {
		cliInfo('found no local instance folders for this scenarion class.');
		return;
	    }
	    if (!internalOptions.instanceFolders) {
		cliInfo(`found instance folders ${instanceFolders.join(", ")}`);
	    }
	    const updateNextInstanceFolder = () => {
		if (instanceFolders.length === 0) {
		    return;
		}
		let ifolder = instanceFolders.shift();
		options.classUpdate = false;
		this.updateInstanceFolder(ifolder, options)
		    .then(() => {
			updateNextInstanceFolder();
		    })
		    .catch(cliError)
	    }
	    updateNextInstanceFolder();
	});
    }

    updateInstanceFolder(folder, options = {}, internalOptions = {}) {
	const { classUpdate } = options;
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
	if (!classUuid) {
	    let msg = `Folder "${folder}" doesn't seem to be connected to a scenarion instance; `
		+ 'please specify a folder that is connected to an RoseStudio scenario instance.';
	    return cliError(msg);
	}
	if (options.classUpdate) {
	    const internalOptions = { uuid: classUuid, instanceFolders: [folder] }
	    const classFolderKey = this.getClassFolderKey(folder);
	    if (!classFolderKey) {
		cliInfo(`no scenario class found in local folder; downloading just the instance`
			+ ` code from the RoseStudio server.`);
	    } else {
		const classFolder = this.getFolderNameFromFolderKey(classFolderKey)
		cliInfo(`updating scenario class folder "${classFolder}"...`);
		this.updateScenarioFolder(classFolder, {}, internalOptions);
		return;
	    }
	}
	//console.log(`found instance object uuid in folder ${folder}`);
	return new Promise((resolve, reject) => {
	    cliInfo(`downloading the instance code for "${folder}"...`, true);
	    const ptimer = cliStartProgress();
	    const deleteFilter = filename => {
		if (filename === roseInitFilename) {
		    return false;
		}
		return true
	    };
	    this.rose.downloadCode(uuid, folder, { deleteFilter }, (err, result) => {
		cliStopProgress(ptimer);
		if (err) {
		    return reject(err);
		}
		cliInfo('done.');
		resolve();
	    });
	})
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

