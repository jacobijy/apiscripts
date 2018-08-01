import { writeFileSync } from 'fs';
import { join } from 'path';

writeFileSync(join(__dirname, '../protocol/file.json'), '');
