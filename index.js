const fs = require('fs');
const path = require('path');
const ProgressBar = require('progress');
const appsettings = JSON.parse(fs.readFileSync('./appsettings.json').toString());
const RESOURCES = JSON.parse(fs.readFileSync('./resources.json'));
const EBX_PATH = appsettings.EbxPath;
const VEHICLE_MAIN_FOLDER_PATH = appsettings.vehicleMainFolder;
const VEHICLE_NAME = appsettings.vehicleName;
const GUID_REGEX = /[A-Z0-9]{8}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{12}/;
const PATH_BEFORE_GUID_REGEX = /\/[A-Z0-9]{8}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{12}/;
const resources = [];
const chunks = [];

function GetReferencedFileNames(file) {
    const rows = file.toString()
        .split(/\r?\n/).join('')
        .split('\t')
        .filter(row => GUID_REGEX.test(row) && PATH_BEFORE_GUID_REGEX.test(row) && row.includes("ResourceName") == false);

    const fileNames = rows.map(row => {
        let path = row.split('/');
        path.pop();
        let firstPartOfPath = path[0].split(' ')[1];
        path.shift();
        path.unshift(firstPartOfPath);
        return path.join('/') + '.txt'
    }).filter(Boolean);

    const uniqueData = [...new Set(fileNames)];
    return uniqueData;
}

function WriteFile(filePath, data) {
    try {
        if (fs.existsSync(filePath) == false) {
            const dir = path.dirname(filePath);
            fs.mkdirSync(dir, { recursive: true });
            fs.writeFileSync(filePath, data);
            console.log(`Write file --> ${filePath}`);
            SearchChunks(filePath, data);
            SearchResources(filePath, data);
            console.log('\n');
        }
    } catch (error) {
        console.error('Error writing file:', error);
    }
}

function SearchResources(filePath, fileData) {
    console.log(`Searching Resources --> ${filePath}`);
    const bar = new ProgressBar(':bar :percent', { total: RESOURCES.length, width: 40 });
    for (let i = 0; i < RESOURCES.length; i++) {
        bar.tick();
        if (fileData.toLowerCase().indexOf(RESOURCES[i].Name.toLowerCase()) > -1) {
            resources.push({
                resourceName: RESOURCES[i].Name,
                resourceType: RESOURCES[i].TypeName,
            });
            bar.tick(bar.total - bar.curr);
            return;
        }
    }
}

function SearchChunks(filePath, fileData) {
    console.log(`Searching Chunks --> ${filePath}`);
    const rows = fileData.toString()
        .split(/\r?\n/).join('')
        .split('\t')
        .filter(row => GUID_REGEX.test(row));

        const bar = new ProgressBar(':bar :percent', { total: rows.length, width: 40 });
        for (let i = 0; i < rows.length; i++) {
            bar.tick();
            if(rows[i].includes("ChunkId")){
                const chunkId = rows[i].split(' ')[1];
                if(chunks.findIndex(ch=> ch == chunkId) == -1){
                    chunks.push(chunkId);
                }
            }
        }
}

var vehicleMainFile = fs.readFileSync(EBX_PATH + VEHICLE_MAIN_FOLDER_PATH + VEHICLE_NAME + '.txt');
WriteFile(path.join(VEHICLE_NAME, VEHICLE_MAIN_FOLDER_PATH + VEHICLE_NAME + '.txt'), vehicleMainFile.toString());

var fileRows = GetReferencedFileNames(vehicleMainFile);

var savedPaths = []
while (fileRows.length > 0) {
    for (const row in fileRows) {
        let file = fs.readFileSync(path.join(EBX_PATH, fileRows[row]));
        WriteFile(path.join(VEHICLE_NAME, fileRows[row]), file.toString());
        if (GetReferencedFileNames(file)) {
            savedPaths.push(...GetReferencedFileNames(file));
        }
    }
    fileRows = [];
    fileRows = JSON.parse(JSON.stringify([...new Set(savedPaths)]));
    savedPaths = [];
}

fs.writeFileSync('./' + VEHICLE_NAME + '/resources_output.json', JSON.stringify(resources, null, 2));
fs.writeFileSync('./' + VEHICLE_NAME + '/chunks.json', JSON.stringify(chunks, null, 2));
