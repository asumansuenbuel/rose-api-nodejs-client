/**
 * Rose Command line interface: command implementations
 *
 * @author Asuman Suenbuel
 */

const fs = require('fs');
const path = require('path');

const { cliInfo, cliError, cliWarn, cliStartProgress, cliStopProgress,
	editFile, editString, stringIsUuid, openUrlInBrowser } = require('./cli-utils');
const { authenticatedRose } = require('./cli-auth');
const { RoseFolder } = require('./rose-folder');

const { green, bold } = require('chalk');

const Table = require('cli-table');

const NoServerCommands = [
    'version',
    'bash-enable-completion',
    'update-rose'
]

class Commands {

    constructor(roseOptions = {}) {
	this.rose = authenticatedRose(roseOptions);
	this.defaultColumns = ['NAME', 'UUID', 'MODIFIED_TIMESTAMP'];
    }

    cli_user(options = {}) {
	const { getUser } = this.rose;
	const { short, json } = options;
	getUser((err, userInfo) => {
	    if (err) return cliError(err);
	    if (json) {
		cliInfo(userInfo)
	    } else {
		cliInfo(userInfo.email);
	    }
	})
    }

    cli_server() {
	cliInfo(this.rose.getServerUrl());
    }

    _checkForRoseInfoInFolder(name) {
	const fullpath = path.resolve(name);
	const rfolder = new RoseFolder(this.rose);
	const pathInfo = rfolder.info[fullpath];
	//console.log(`pathInfo for ${fullpath}: ${JSON.stringify(pathInfo, null, 2)}`);
	return pathInfo;
    }

    _findInAnyEntity(namePattern, callback) {
	const { findEntities } = this.rose;
	let qterm = _getQueryTermFromPattern('NAME', namePattern);
	var entityNames = ['connections', 'robots', 'backend_systems'];
	const _findInNextEntity = () => {
	    if (entityNames.length === 0) {
		return callback(`no entity matching "${namePattern}" found.`);
	    }
	    const entityName = entityNames.shift();
	    //console.log(`finding ${namePattern} in ${entityName}...`)
	    findEntities(entityName, qterm, (err, obj) => {
		if (err) {
		    console.log(`not found: ${err}`);
		    return _findInNextEntity();
		}
		callback(null, obj, entityName);
	    });
	}
	_findInNextEntity();
    }

    cli_open(namePatternOrFolder, options = {}) {
	const rfolder = new RoseFolder(this.rose);

	const _open = url => {
	    cliInfo(`opening ${url}...`, true);
	    openUrlInBrowser(url);
	    cliInfo('done.');
	}
	const finfo = rfolder.getFolderInfo(namePatternOrFolder);
	if (finfo && finfo.object) {
	    let entity = 'CONNECTIONS';
	    let url = this.rose.getRoseStudioEntityPageUrl(entity, finfo.object.UUID);
	    return _open(url);
	}

	const namePattern = namePatternOrFolder;
	if (namePattern) {
	    this._findInAnyEntity(namePattern, (err, records, entity) => {
		if (err) {
		    return cliError(err);
		}
		if (records.length === 0) {
		    //cliError('nothing to open...');
		    return;
		}
		let obj = records[0];
		let url = this.rose.getRoseStudioEntityPageUrl(entity, obj.UUID);
		_open(url);
	    });
	} else {
	    let url = this.rose.getServerUrl();
	    _open(url);
	}
    }	
    
    cli_list(entity, namePattern = null, options = {}) {
	const { getEntity, getEntities, findEntities } = this.rose;
	const entityName = _getEntityName(entity);
	const _sortByName = (obj1, obj2) => {
	    let n1 = obj1.NAME;
	    let n2 = obj2.NAME;
	    return n1 > n2 ? 1 : n2 > n1 ? -1 : 0;
	}
	const showRecords = (err, records) => {
	    if (err) return cliError(err);
	    if (!Array.isArray(records)) {
		records = [records];
	    }
	    if (options.json) {
		return cliInfo(records);
	    }
	    if (options.uuid) {
		let uuids = records.map(({ UUID }) => UUID);
		cliInfo(uuids.join(','));
		return;
	    }
	    let columns = this.defaultColumns;
	    if (typeof options.fields === 'string') {
		columns = options.fields.split(/\s*,\s*/);
		//console.log(`columns: ${columns}`)
	    }
	    if (records.length === 0) {
		cliInfo('no matching records found.');
		return;
	    }
	    const table = new Table({
		head: columns,
		chars: _plainChars
	    });
	    records.sort(_sortByName).forEach(obj => {
		let row = columns.map(key => {
		    let value = obj[key];
		    let str;
		    if (typeof value === 'object') {
			str = JSON.stringify(value, null, 2);
		    } else {
			str = String(value);
		    }
		    return str;
		});
		table.push(row);
	    });
	    cliInfo(table.toString());
	    //cliInfo(records.map(({NAME}) => NAME).sort().join('\n'));
	};
	const _maybeShowInstances = (err, records) => {
	    if (err) return cliError(err);
	    if (!Array.isArray(records)) {
		records = [records];
	    }
	    if (entity === 'instances') {
		if (records.length !== 1) {
		    return cliError(`"${namePattern}" matched ${records.length} scenario classes; `
				    + `in order to display scenario instances the name pattern `
				    + `must resolve to exactly one scenario class.`);
		}
		let classUuid = records[0].UUID;
		let className = records[0].NAME;
		let qterm = { CLASS_UUID: classUuid };
		if (!options.uuid) {
		    cliInfo(bold(` Instances of scenario class "${className}":`))
		}
		findEntities(entityName, qterm, showRecords);
	    } else {
		return showRecords(null, records)
	    }
	}
	if (typeof namePattern === 'string') {
	    if (stringIsUuid(namePattern)) {
		let uuid = namePattern;
		getEntity(entityName, uuid, _maybeShowInstances);
	    } else {
		let qterm = _getQueryTermFromPattern('NAME', namePattern);
		if (entityName === 'connections') qterm.CLASS_UUID = "$isnull";
		findEntities(entityName, qterm, _maybeShowInstances);
	    }
	} else {
	    if (entity === 'instances') {
		return cliError('please specify a name (pattern) for the scenario class')
	    }
	    if (entityName === 'connections') {
		let qterm = { CLASS_UUID: "$isnull" };
		findEntities(entityName, qterm, showRecords);
	    } else {
		getEntities(entityName, showRecords);
	    }
	}
    }

    cli_info(folder, options = {}) {
	const rfolder = new RoseFolder(this.rose);
	const info = rfolder.info;

	const NOMARKS = '///NOMARKS///';
	
	const showInfo = (infoKeys, markInstances, markClasses) => {
	    const head = options.link
		  ? ['Folder', 'RoseStudio URL']
		  : ['Folder', 'Name in RoseStudio', 'Local?', 'Type', 'UUID'];
	    const table = new Table({
		head,
		chars: _plainChars
	    });
	    const classMark = ' ┌── '
	    const instanceMark = ' └── ';
	    let addMarks = true;
	    infoKeys.forEach(fullpath => {
		if (fullpath === NOMARKS) {
		    addMarks = false;
		    return;
		}
		let rpath = path.relative(fs.realpathSync('.'), fullpath);
		let finfo = info[fullpath];
		let type = finfo.isClass ? "class" : "instance";
		let name = finfo.object ? finfo.object.NAME : '?';
		let localInfo = finfo.object && !!finfo.object.ISLOCAL ? "local" : "server";
		let prefix = '';
		if (addMarks && !finfo.isClass) {
		    prefix = markInstances ? instanceMark : markClasses ? classMark : '';
		}
		let uuid = finfo.object ? finfo.object.UUID : '?';
		let url = this.rose.getRoseStudioConnectionPageUrl(uuid);
		let row = options.link ? [rpath, url] : [rpath, name, localInfo, type, uuid];
		row[0] = prefix + row[0]
		table.push(row);
	    });
	    cliInfo(table.toString());
	}

	const getFolderKeys = folder => {
	    let finfo = rfolder.getFolderInfo(folder);
	    if (!finfo || !finfo.object) {
		throw(`folder "${folder}" doesn't seem to be connected to any RoseStudio scenario.`);
		//return;
	    }
	    const folderKey = rfolder.getFolderInfoKey(folder);
	    let infoKeys;
	    let markInstances = false,
		markClasses = false;
	    if (finfo.isClass) {
		markInstances = true;
		let instancesKeys = rfolder.getAllInstanceFolderKeys(folder);
		infoKeys = [folderKey, ...instancesKeys];
	    } else {
		markClasses = true;
		let classKey = rfolder.getClassFolderKey(folder);
		infoKeys = [folderKey, classKey];
	    }
	    //showInfo(infoKeys, markInstances, markClasses);
	    return { infoKeys, markInstances, markClasses };
	}

	if (folder) {
	    try {
		let { infoKeys, markInstances, markClasses } = getFolderKeys(folder);
		showInfo(infoKeys, markInstances, markClasses);
	    } catch (err) {
		return cliError(err);
	    }
	    return;
	}

	const getSortedKeys = () => {
	    let keys = [];
	    let classKeyUuidMap = rfolder.getAllClassKeysAndUuids();
	    let classKeys = Object.keys(classKeyUuidMap);
	    classKeys.forEach(classKey => {
		let uuid = classKeyUuidMap[classKey];
		// add the class key:
		keys.push(classKey);
		// add all the keys of the instances
		keys.push(...rfolder.getAllInstanceFolderKeys(uuid));
	    });
	    let allKeys = Object.keys(rfolder.info);
	    allKeys.forEach(key => {
		if (keys.includes(key)) return;
		console.log(`adding 'orphaned' key ${key}...`)
		keys.push(NOMARKS); // tell the output loop to stop adding marks
		keys.push(key);
	    });
	    return keys;
	};

	showInfo(getSortedKeys(), true, false);
    }

    cli_scenarios(namePattern = null, options = {}) {
    }

    cli_initScenario(folder, options = {}) {
	const rfolder = new RoseFolder(this.rose);
	rfolder.initScenarioInteractively(folder, options);
    }

    cli_createScenario(folder, options = {}) {
	const rfolder = new RoseFolder(this.rose);
	options.create = true;
	rfolder.initScenarioInteractively(folder, options);
    }

    cli_initInstance(classFolder, options = {}) {
	const rfolder = new RoseFolder(this.rose);
	rfolder.initInstanceInteractively(classFolder, options);
    }

    cli_createInstance(classFolder, options = {}) {
	const rfolder = new RoseFolder(this.rose);
	options.create = true;
	rfolder.initInstanceInteractively(classFolder, options);
    }

    cli_updateInstance(instanceFolder, options = {}) {
	const rfolder = new RoseFolder(this.rose);
	return rfolder.updateInstanceFolder(instanceFolder, options);
    }

    cli_updateScenario(scenarioFolder, options = {}) {
	const rfolder = new RoseFolder(this.rose);
	return rfolder.updateScenarioFolder(scenarioFolder, options);
    }

    cli_updateScenarioOrInstance(folder, options = {}) {
	const rfolder = new RoseFolder(this.rose);
	return rfolder.updateScenarioOrInstance(folder, options);
    }

    cli_showConfig(name, options = {}) {
	options._show = true;
	this.cli_edit(name, options);
    }

    cli_cleanup(options = {}) {
	const rfolder = new RoseFolder(this.rose);
	rfolder.cleanup(options);
    }

    cli_edit(name, options = {}) {
	const pathInfo = this._checkForRoseInfoInFolder(name);

	const _doEdit = (err, obj) => {
	    if (err) return cliError(err);
	    const { UUID, CLASS_UUID, NAME } = obj;
	    //const configJson = this.rose.getConfigJsonFromObject(obj);

	    this.rose.getConnectionConfigJsonFromObject(obj, (err, configJson) => {
		if (err) {
		    return cliError(err);
		}
		const cstr = JSON.stringify(configJson, null, 2);

		if (options._show) {
		    return cliInfo(cstr);
		}
		
		editString(cstr, "json", (newContent, hasChanged, reopenEditor) => {
		    if (!hasChanged) {
			cliInfo('no changes; nothing done');
			return;
		    }
		    try {
			const newConfigJson = JSON.parse(newContent);
			cliInfo(`updating config for "${NAME}"...`, true);
			const ptimer = cliStartProgress();
			this.rose.updateConnectionConfigJson(UUID, newConfigJson, (err, obj) => {
			    cliStopProgress(ptimer);
			    if (err) {
				return cliError(err);
			    }
			    //cliInfo(`config-json successfully updated on server for "${NAME}".`);
			    cliInfo('done.');
			    if (pathInfo && CLASS_UUID) {
				if (options.update) {
				    //cliInfo('updating instance folder...');
				    let updateOptions = {
					classUpdate: false,
					internalCall: true
				    }
				    this.cli_updateInstance(name, updateOptions)
				} else {
				    cliInfo(`instance folder hasn't been updated; please run `
					    + `"rose update ${NAME}" to do that.`);
				}
			    } else {
				//cliInfo('done.');
			    }
			});
		    } catch (err) {
			cliError(`config must be valid JSON: ${err}`);
			if (typeof reopenEditor === 'function') {
			    cliInfo('Re-opening editor in 5 seconds; Ctrl-C to abort...', true);
			    let ptimer = cliStartProgress();
			    setTimeout(() => {
				cliStopProgress(ptimer);
				cliInfo('');
				reopenEditor();
			    } , 5000);
			}
			return;
		    }
		});
	    });
	}

	if (pathInfo && pathInfo.object && pathInfo.object.UUID) {
	    this.rose.getConnection(pathInfo.object.UUID, _doEdit);
	} else {
	    this.rose.findOneConnection({ NAME: { "$like": name } }, _doEdit);
	}
    }

}

const _getEntityName = entity => {
    const entityName = entity.toLowerCase();
    if (entityName.startsWith('robot')) return 'robots';
    if (entityName.indexOf('system') >= 0) return 'backend_systems';
    if (entityName.startsWith('connection')
	|| entityName.startsWith('scenario')
	|| entityName === "instances") {
	return 'connections';
    }
    throw `Unknown entity name "${entity}"; has to be one of 'robots', 'backend_systems', or 'connections'.`
    return entity;
};

const _getQueryTermFromPattern = (fieldName, pattern) => {
    const qpattern = pattern.replace(/\*/g,'%').replace(/\?/g,'_');
    return { [fieldName]: { "$like": qpattern } };
};

const _plainChars = { 'top': '' , 'top-mid': '' , 'top-left': '' , 'top-right': ''
         , 'bottom': '' , 'bottom-mid': '' , 'bottom-left': '' , 'bottom-right': ''
         , 'left': '' , 'left-mid': '' , 'mid': '' , 'mid-mid': ''
         , 'right': '' , 'right-mid': '' , 'middle': '' }

const _getRoseApiOptionsFromEnv = () => {
    const options = {};
    const { ROSE_SERVER_URL } = process.env
    if (typeof ROSE_SERVER_URL === 'string') {
	options.apiUrl = ROSE_SERVER_URL;
	options.debug = false;
    }
    return options;
}

// export all methods of the Commands class that start with "cli_"
// using the name with the "cli_" prefix removed:
const roseOptions = _getRoseApiOptionsFromEnv();
const commandsInstance = new Commands(roseOptions);
const exportsObject = {};
const proto = Object.getPrototypeOf(commandsInstance);
Object.getOwnPropertyNames(proto)
    .filter(p => (typeof proto[p] === 'function') && (p.startsWith('cli_')))
    .forEach(fn => {
	//console.log(`method found: ${fn}`);
	const cliName = fn.substring(4);
	module.exports[cliName] = (...args) => {
	    const f = commandsInstance[fn].bind(commandsInstance);
	    if (!NoServerCommands.includes(cliName) && !commandsInstance.rose) {
		cliWarn(`You are not logged in into Rose. Please run "rose login".`);
		return;
	    }
	    try {
		return f(...args);
	    } catch (err) {
		cliError(err);
	    }
	}
    });
