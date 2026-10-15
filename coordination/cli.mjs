import fs from 'node:fs';
import {applyCommand,emptyQueue,inspectQueue} from './queue.mjs';
const [action,input,command,output]=process.argv.slice(2);
if(action==='init')console.log(JSON.stringify(emptyQueue(),null,2));
else if(action==='inspect')console.log(JSON.stringify(inspectQueue(JSON.parse(fs.readFileSync(input,'utf8').replace(/^\uFEFF/,''))),null,2));
else if(action==='apply'){
 if(!output)throw new Error('Usage: node coordination/cli.mjs apply QUEUE.json COMMAND.json NEXT.json');
 const read=p=>JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
 const r=applyCommand(read(input),read(command));fs.writeFileSync(output,JSON.stringify(r.queue,null,2)+'\n');console.log(JSON.stringify(r.result,null,2));
}else throw new Error('Actions: init, inspect, apply');
