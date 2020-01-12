/**
 * Command line interface - folder related actions
 *
 * @author Asuman Suenbuel
 */

const fs = require('fs');
const path = require('path');
const inquirer = require('inquirer');

const { cliInfo, cliWarn, cliError, getUniqueNameListAndHash,
	findAllFiles, stringIsUuid, allFilenamesInFolder } = require('./cli-utils');
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

    _writeFolderInfo(folder, isClass, object) {
	const initFile = this.getInitFileInFolder(folder);
	const json = { isClass, object };
	fs.writeFileSync(initFile, JSON.stringify(json), 'utf-8');
    }

    getFolderInfo(folder) {
	let infoKey = path.resolve(folder);
	return this.$info[infoKey];
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
		    let localFolder;
		    this._selectExistingFolder('Please select the root folder that contains '
					       + 'your source code (template)')
			.then(folder => {
			    console.log(`local folder: ${folder}`);
			    localFolder = folder;
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
			    //console.log(`new object created: ${JSON.stringify(newObject, null, 2)}`);
			    const { NAME, UUID } = newObject;
			    if (!UUID) {
				throw "something went wrong during the creation of the new scenario"
			    }
			    this._writeFolderInfo(localFolder, true, newObject);
			    const url = this.rose.getRoseStudioConnectionPageUrl(UUID);
			    cliInfo(`new connection object created and connected to local folder "${localFolder}"`);
			    cliInfo(`RoseStudio url: ${url}`);
			    return newObject;
			})
			.then(obj => {
			    const { UUID } = obj;
			    if (!UUID) {
				throw "something went wrong, UUID is missing from object"
			    }
			    cliInfo(`uploading source code to RoseStudio...`);
			    return new Promise((resolve, reject) => {
				this.rose.uploadCodeTemplate(UUID, localFolder, (err, result) => {
				    if (err) return reject(err);
				    cliInfo('done');
				    resolve();
				});
			    });
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
    initInstanceInteractively(classFolder, debug = true) {
	
	const doInit = classObject => {
	    const { UUID, CLASS_UUID, NAME } = classObject; //folderInfo.object;
	    const scenarioClassName = NAME;
	    if (!!CLASS_UUID) {
		return showError();
	    }
	    return new Promise((resolve, reject) => {
		this.rose.getAllConnectionInstances(UUID, (err, instanceObjects) => {
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
			return inquirer
			    .prompt({
				type: 'confirm',
				name: 'result',
				message: 'Do you want to create a new instance?',
				'default': true
			    })
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
			inquirer
			    .prompt({ type, name, message, choices, 'default': 0 })
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

    updateInstanceFolder(folder, options = {}) {
	const finfo = this.getFolderInfo(folder);
	//console.log(`finfo: ${JSON.stringify(finfo, null, 2)}`);
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
	//console.log(`found instance object uuid in folder ${folder}`);
	return new Promise((resolve, reject) => {
	    cliInfo('downloading the instance code...');
	    const deleteFilter = filename => {
		if (filename === roseInitFilename) {
		    console.log('deleteFilter detected roseInitFilename');
		    return false;
		}
		return true
	    };
	    this.rose.downloadCode(uuid, folder, { deleteFilter }, (err, result) => {
		if (err) {
		    return reject(err);
		}
		cliInfo('done.');
		resolve();
	    });
	})
    }

}

module.exports = { RoseFolder };

