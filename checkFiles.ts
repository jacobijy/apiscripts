import { join } from 'path';
import { promises as fs } from 'fs';

const path = join(__dirname, '../protocol');
export default async function getFiles() {
	let files: string[] ;
	let filehistory: any = {};
	try {
		files = await fs.readdir(path, 'utf8');
	} catch (err) {
		console.log('directory is empty');
		return;
	}
	try {
		filehistory = await import(join(path, 'file.json'));
	} catch (err) {
		console.log(err);
	}
	const filesChanged: string[] = [];
	files.forEach(async value => {
		const fileState = await fs.stat(path + '/' + value);
		let prevState = filehistory[value.split('.')[0]] === undefined ? 0 : filehistory[value.split('.')[0]];
		const curState = fileState.mtimeMs;
		if (prevState === curState || value.endsWith('.json') || value === 'module_template.txt' || !value.endsWith('.txt')) {
			return;
		}
		else {
			prevState = curState;
			filehistory[value.split('.')[0]] = prevState;
			filesChanged.push(value);
		}
	});
	await fs.writeFile(join(path, 'file.json'), JSON.stringify(filehistory, null, '\t'));
	// console.log(files, filesChanged);
	return filesChanged;
}
