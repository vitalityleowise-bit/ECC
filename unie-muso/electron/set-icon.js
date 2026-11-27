'use strict';
/* Pose l'icône UNIE-MUSO et les informations de version sur UNIE-MUSO.exe, sans Wine. */
const fs = require('fs');
const path = require('path');
const ResEdit = require('resedit');

const exe = path.join(__dirname, 'release', 'win-unpacked', 'UNIE-MUSO.exe');
const data = fs.readFileSync(exe);
const res = ResEdit.NtExecutableResource.from(ResEdit.NtExecutable.from(data, { ignoreCert: true }));
const exeObj = ResEdit.NtExecutable.from(data, { ignoreCert: true });
const resource = ResEdit.NtExecutableResource.from(exeObj);
const ico = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(__dirname, 'icon.ico')));
ResEdit.Resource.IconGroupEntry.replaceIconsForResource(resource.entries, 1, 1033, ico.icons.map((i) => i.data));
const vi = ResEdit.Resource.VersionInfo.fromEntries(resource.entries)[0];
const lang = { lang: 1033, codepage: 1200 };
vi.setStringValues(lang, {
  FileDescription: 'UNIE-MUSO', ProductName: 'UNIE-MUSO', CompanyName: 'UNIE-MUSO', InternalName: 'UNIE-MUSO',
  OriginalFilename: 'UNIE-MUSO.exe', LegalCopyright: 'UNIE-MUSO, Petit-Goave',
});
vi.setFileVersion(3, 7, 1, 0, 1033); vi.setProductVersion(3, 7, 1, 0, 1033);
vi.outputToResourceEntries(resource.entries);
resource.outputResource(exeObj);
fs.writeFileSync(exe, Buffer.from(exeObj.generate()));
void res;
console.log('Icône et version posées sur', exe);
