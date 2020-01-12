/**
 * Rose Command line interface: command implementations
 *
 * @author Asuman Suenbuel
 */

const fs = require('fs');
const path = require('path');

const { cliInfo, cliError, cliWarn, editFile, editString, stringIsUuid } = require('./cli-utils');
const { authenticatedRose } = require('./cli-auth');
const { RoseFolder } = require('./rose-folder');

const Table = require('cli-table');

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

    _checkForRoseInfoInFolder(name) {
	const fullpath = path.resolve(name);
	const rfolder = new RoseFolder(this.rose);
	const pathInfo = rfolder.info[fullpath];
	//console.log(`pathInfo for ${fullpath}: ${JSON.stringify(pathInfo, null, 2)}`);
	return pathInfo;
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
	    const table = new Table({
		head: columns,
		chars: _plainChars
	    });
	    records.sort(_sortByName).forEach(obj => {
		let row = columns.map(key => String(obj[key]));
		table.push(row);
	    });
	    cliInfo(table.toString());
	    //cliInfo(records.map(({NAME}) => NAME).sort().join('\n'));
	};
	if (typeof namePattern === 'string') {
	    if (stringIsUuid(namePattern)) {
		let uuid = namePattern;
		getEntity(entityName, uuid, (err, obj) => showRecords(err, [obj]));
	    } else {
		let qterm = _getQueryTermFromPattern('NAME', namePattern);
		findEntities(entityName, qterm, showRecords);
	    }
	} else {
	    getEntities(entityName, showRecords);
	}
    }

    cli_info(folder, options = {}) {
	const rfolder = new RoseFolder(this.rose);
	if (folder) {
	    const folderInfo = rfolder.getFolderInfo(folder);
	    console.log(JSON.stringify(folderInfo, null, 2));
	}
	const info = rfolder.info;
	const head = options.link
	      ? ['Folder', 'RoseStudio URL']
	      : ['Folder', 'Name in RoseStudio', 'Type', 'UUID'];
	const table = new Table({
	    head,
	    chars: _plainChars
	});
	Object.keys(info).forEach(fullpath => {
	    let rpath = path.relative(fs.realpathSync('.'), fullpath);
	    let finfo = info[fullpath];
	    let type = finfo.isClass ? "class" : "instance";
	    let name = finfo.object ? finfo.object.NAME : '?';
	    let uuid = finfo.object ? finfo.object.UUID : '?';
	    let url = this.rose.getRoseStudioConnectionPageUrl(uuid);
	    let row = options.link ? [rpath, url] : [rpath, name, type, uuid];
	    table.push(row);
	});
	cliInfo(table.toString());
    }

    cli_scenarios(namePattern = null, options = {}) {
    }

    cli_initScenario(options = {}) {
	const rfolder = new RoseFolder(this.rose);
	rfolder.initConnectionInteractively(true);
    }

    cli_initInstance(classFolder, options = {}) {
	const rfolder = new RoseFolder(this.rose);
	rfolder.initInstanceInteractively(classFolder);
    }

    cli_updateInstance(instanceFolder, options = {}) {
	const rfolder = new RoseFolder(this.rose);
	rfolder.updateInstanceFolder(instanceFolder, options);
    }

    cli_edit(name, options = {}) {
	const _doEdit = (err, obj) => {
	    if (err) return cliError(err);
	    const { UUID, NAME } = obj;
	    const configJson = this.rose.getConfigJsonFromObject(obj);
	    const cstr = JSON.stringify(configJson, null, 2);
	    
	    editString(cstr, "json", (newContent, hasChanged) => {
		if (!hasChanged) {
		    cliInfo('no changes; nothing done');
		    return;
		}
		//console.log(newContent);
		try {
		    const newConfigJson = JSON.parse(newContent);
		    this.rose.updateConnectionConfigJson(UUID, newConfigJson, (err, obj) => {
			if (err) {
			    return cliError(err);
			}
			cliInfo(`config-json successfully updated on server for "${NAME}".`);
		    });
		} catch (err) {
		    cliError(`config must be valid JSON: ${err}`);
		    return;
		}
	    });
	}
	const pathInfo = this._checkForRoseInfoInFolder(name);
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
    if (entityName.startsWith('connection') || entityName.startsWith('scenario')) {
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
	    if (!commandsInstance.rose) return;
	    return f(...args);
	}
    });
