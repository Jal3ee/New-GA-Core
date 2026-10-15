import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const directory=path.join(root,'browser-extension/ga-core-ereq');
const entries=await Promise.all((await fs.readdir(directory)).sort().map(async name=>({name,bytes:await fs.readFile(path.join(directory,name))})));
entries.push({name:'bhpEreq.js',bytes:await fs.readFile(path.join(root,'src/utils/bhpEreq.js'))});
const crc32=bytes=>{
  let crc=0xffffffff;
  for(const byte of bytes){crc^=byte;for(let bit=0;bit<8;bit++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  return (crc^0xffffffff)>>>0;
};
// A deterministic uncompressed ZIP, with no external packaging dependency.
const local=[],central=[];let offset=0;
for(const {name,bytes} of entries){
  const filename=Buffer.from(name),crc=crc32(bytes);
  const head=Buffer.alloc(30);head.writeUInt32LE(0x04034b50);head.writeUInt16LE(20,4);head.writeUInt16LE(0x21,12);head.writeUInt32LE(crc,14);head.writeUInt32LE(bytes.length,18);head.writeUInt32LE(bytes.length,22);head.writeUInt16LE(filename.length,26);
  const index=Buffer.alloc(46);index.writeUInt32LE(0x02014b50);index.writeUInt16LE(20,4);index.writeUInt16LE(20,6);index.writeUInt16LE(0x21,14);index.writeUInt32LE(crc,16);index.writeUInt32LE(bytes.length,20);index.writeUInt32LE(bytes.length,24);index.writeUInt16LE(filename.length,28);index.writeUInt32LE(offset,42);
  local.push(head,filename,bytes);central.push(index,filename);offset+=head.length+filename.length+bytes.length;
}
const index=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(entries.length,8);end.writeUInt16LE(entries.length,10);end.writeUInt32LE(index.length,12);end.writeUInt32LE(offset,16);
const output=path.join(root,'public/downloads/ga-core-auto-ereq.zip');await fs.mkdir(path.dirname(output),{recursive:true});await fs.writeFile(output,Buffer.concat([...local,index,end]));
console.log(`Auto e-Req extension packaged: ${entries.length} files.`);
