import { join } from 'path';
import writeFile from './writeFile';

interface IJson {
	[key: string]: any;
}

const createActionInfo = (moduleName: string, actionName: string, info: IJson, type: 'in' | 'out') => {
	const action = { module_name: moduleName, action_name: actionName };
	const protocol = Object.keys(info[type]).map(value => ({ name: value, type: info[type][value] }));
	return Object.assign(action, { protocol });
};

const createActions = (moduleName: string, actionName: string, info: IJson) => {
	const protocolIn = createActionInfo(moduleName, actionName, info, 'in');
	const protocolOut = createActionInfo(moduleName, actionName, info, 'out');
	return { in: protocolIn, out: protocolOut };
};

const getProtocolName = (moduleId: number, actionId: number, type: 'in' | 'out') => {
	return `protocol_${type === 'in' ? 'down' : 'up'}_${moduleId}_${actionId}.json`;
};

const writeActionJsons = async (moduleId: number, actionId: number, data: string, type: 'in' | 'out') => {
	const jsonName = getProtocolName(moduleId, actionId, type);
	const filename = join('', `./test/${type === 'in' ? 'down' : 'up'}/${jsonName}`);
	await writeFile(filename, data);
	return filename;
};

function createClass(moduleName: string, actionName: string, moduleId: number, info: IJson) {
	const classInfo = { module_name: moduleName, action_name: actionName, module_id: moduleId };
	const protocol = Object.keys(info).map(value => ({ name: value, type: info[value] }));
	return Object.assign(classInfo, { protocol });
}

async function writeClassJsons(moduleName: string, className: string, data: string) {
	const classfileName = `protocol_classes_${moduleName}_${className}.json`;
	const filename = join('.', `./test/class/${classfileName}`);
	await writeFile(filename, data);
}

export default function createProtocols(moduleName: string, moduleId: number, moduleInfo: IJson) {
	Object.keys(moduleInfo).map(async (value, index) => {
		const actionName = moduleInfo[value].name;
		if (!Object.is(parseInt(value), NaN)) {
			const actionId = parseInt(value);
			const actions = createActions(moduleName, actionName, moduleInfo[value]);
			await writeActionJsons(moduleId, actionId, JSON.stringify(actions.in, null, '\t'), 'in');
			await writeActionJsons(moduleId, actionId, JSON.stringify(actions.out, null, '\t'), 'out');
		}
		else {
			const classInfo = createClass(moduleName, value, moduleId, moduleInfo[value]);
			await writeClassJsons(moduleName, value, JSON.stringify(classInfo, null, '\t'));
		}
	});
}
