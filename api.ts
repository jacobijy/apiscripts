import { promises as fs } from 'fs';
import { join } from 'path';
import checkFiles from './checkFiles';
import createProtocols from './protocols';
import createModules from './modules';
let moduleName = '';
let moduleId = '';
const mapActions: { [key: string]: any } = {};

const getModule = (data: string) => {
	const reg = /([^=\s]+)\s*=\s*([^=\s]+)\s*{([\s\S]*)}/;
	const array = reg.exec(data);
	moduleName = array[1];
	moduleId = array[2];
	return array[3];
};

const splitClass = (classes: string) => {
	const regclass = /([\s\S]*)(\s+)([a-z_]+)\s*=\s*\d/;
	let arr = regclass.exec(classes);
	let classString = arr[1];
	const regsplit = /class\s*([^\s]*)/g;
	const regDetail = /([a-zA-Z_]+\s*):\s*([a-z<>_]+({[^}]*})*)/g;
	let array = classString.split(regsplit);
	console.log(array);
	let className = '';
	let classIndex = 0;
	array.map((value, index) => {
		if (index % 2 === 1) {
			className = value;
			Object.assign(mapActions, { [className]: {} });
		}
		else if (index > 0) {
			regclass.lastIndex = 0;
			regDetail.lastIndex = 0;
			getAllInfoReg(value, regDetail, mapActions[className], 'class');
			regDetail.lastIndex = 0;
			classIndex++;
		}
	});
	return classes.replace(classString, '');
};

// get data name and type from every single config
const getAllInfoReg = (text: string, reg: RegExp, result: { [key: string]: any }, tag: string) => {
	let variable;
	switch (tag) {
		case 'in':
			if (result.in === undefined) {
				Object.assign(result, { in: {} });
			}
			variable = result.in;
			break;

		case 'out':
			if (result.out === undefined) {
				Object.assign(result, { out: {} });
			}
			variable = result.out;
			break;

		case 'class':
			variable = result;
			break;

		default:
			break;
	}
	reg.lastIndex = 0;
	let array = reg.exec(text);
	while (array !== null) {
		const key = array[1].replace(/\s/g, '');
		const value = array[2];
		if (value.startsWith('enum')) {
			const enumarr: string[] = [];
			const regEnum = /enum{([\s\S]*)}/;
			const enumString = regEnum.exec(value)[1];
			enumString.split(/\s/).map(enums => {
				if (enums === '') {
					return;
				}
				enumarr.push(enums);
			});
			Object.assign(variable, { [key]: { enum: enumarr } });
		}
		else if (value.startsWith('list{')) {
			const listObj: { [key: string]: any } = {};
			const regList = /list{([\s\S]*)}/;
			const listString = regList.exec(value)[1];
			listString.split('\n').map(obj => {
				obj = obj.replace(/\s/g, '');
				if (obj === '') {
					return;
				}
				Object.assign(listObj, { [obj.split(':')[0]]: obj.split(':')[1] });
			});
			Object.assign(variable, { [key]: { list: listObj } });
		}
		else {
			Object.assign(variable, { [key]: array[2] });
		}
		array = reg.exec(text);
	}
};

// split actions in one module
// split in and out config in one action
const splitActions = (actions: string) => {
	// const reg = /([^=\s]+)\s*=\s*([^=\s]+)\s*{\s*(in\s*{[^}]*})\s*(out\s*{[^}]*})[^}]*}/g;
	const reg = /([^=\s]+)\s*=\s*([^=\s]+)\s*/g;
	const regin = /in\s*{([\s\S]*)}\s*out/g;
	const regout = /out\s*{([\s\S]*)}\s*}/g;
	const regDetail = /([a-zA-Z_]+\s*):\s*([a-z<>_]+({[^}]*})*)/g;

	const splitInOut = (action: string) => {
		const reg1 = /(in|out)\s*{([\s\S]*)}/;
		return reg1.exec(action);
	};
	console.log(actions);
	const array = actions.trim().split(reg);
	let tempArray = reg.exec(actions);
	const actionIds: string[] = [];
	while (tempArray) {
		actionIds.push(tempArray[2]);
		tempArray = reg.exec(actions);
	}
	console.log(actionIds);
	let actionName = '';
	let actionIndex = 0;
	array.map((value, index) => {
		if (index % 3 === 1) {
			actionName = value;
		}
		else if (index % 3 === 2) {
			Object.assign(mapActions, { [actionIds[actionIndex]]: { name: actionName } });
		}
		else if (index > 0) {
			regin.lastIndex = 0;
			regout.lastIndex = 0;
			const inarray = regin.exec(value);
			const outarray = regout.exec(value);
			regDetail.lastIndex = 0;
			getAllInfoReg(inarray[1], regDetail, mapActions[actionIds[actionIndex]], 'in');
			regDetail.lastIndex = 0;
			getAllInfoReg(outarray[1], regDetail, mapActions[actionIds[actionIndex]], 'out');
			actionIndex++;
		}
	});
};

// delete comment in config file
const deletCrlf = (text: string) => {
	const reg = /\n[\s| |\t]\/\/.*\r/g;
	const reg2 = /\/\/.*/g;
	return text.replace(reg, '').replace(reg2, '');
};

const deleteOldProtocols = async (files: string[]) => {
	const upfiles = await fs.readdir(join(__dirname, '../protocol/up'));
	const downfiles = await fs.readdir(join(__dirname, '../protocol/down'));
	files.forEach(file => {
		const moduleIdTmp = file.split('_')[0];
		upfiles.forEach(upfile => {
			if (upfile.split('_')[2] === moduleIdTmp) {
				fs.unlink(join(__dirname, '../protocol/up') + upfile);
			}
		});
		downfiles.forEach(downfile => {
			if (downfile.split('_')[2] === moduleIdTmp) {
				fs.unlink(join(__dirname, '../protocol/up') + downfile);
			}
		});
	});
};

const readProtocolConfig = async (file: string) => {
	const fileschanged = await checkFiles();
	await deleteOldProtocols(fileschanged);
	let data = await fs.readFile(join(__dirname, '../protocol', file), 'utf8');
	data = deletCrlf(data);
	const actions = getModule(data);
	const classes = splitClass(actions);
	splitActions(classes);
	createProtocols(moduleName, parseInt(moduleId), mapActions);
	createModules(mapActions, moduleId, moduleName);
};

readProtocolConfig('10_poke.txt');
