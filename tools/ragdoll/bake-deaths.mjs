// npm ci --prefix tools/ragdoll && npm run bake --prefix tools/ragdoll
// Physics is an authoring dependency only. The app loads the baked skeletal clips.
import * as THREE from 'three';
import * as C from 'cannon-es';
import {simulateRagdoll,defaultSettings,importPreset,exportPreset} from '../../ragdoll-simulation.js';
import {GLTFLoader} from 'three/examples/jsm/loaders/GLTFLoader.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const repo=path.resolve(import.meta.dirname,'../..'),threePath=path.resolve(import.meta.dirname,'node_modules/three');
globalThis.ProgressEvent=class{constructor(type,init){Object.assign(this,{type},init)}};
const moduleUrl=pathToFileURL(path.join(threePath,'build/three.module.js')).href,examplesUrl=pathToFileURL(path.join(threePath,'examples/jsm')).href+'/';
const code=(await fs.readFile(path.join(repo,'rifleman.js'),'utf8')).replaceAll('https://esm.sh/three@0.169.0/examples/jsm/',examplesUrl).replaceAll('https://esm.sh/three@0.169.0',moduleUrl);
const {createRifleman,calibrateRiflemanWeapon}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
async function load(relative){
 const file=path.join(repo,relative),bytes=await fs.readFile(file);let json;
 if(relative.endsWith('.glb')){const length=bytes.readUInt32LE(12);json=JSON.parse(bytes.subarray(20,20+length));json.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(length+28).toString('base64');}
 else{json=JSON.parse(bytes);for(const buffer of json.buffers)buffer.uri='data:application/octet-stream;base64,'+(await fs.readFile(path.resolve(path.dirname(file),buffer.uri))).toString('base64');}
 delete json.images;delete json.textures;json.materials=[{}];for(const mesh of json.meshes)for(const primitive of mesh.primitives)primitive.material=0;
 return new GLTFLoader().parseAsync(JSON.stringify(json),'');
}
const reference=await load('assets/reference/scene.gltf'),library=await load('assets/animations/UAL1_Standard.glb');
const garments=await Promise.all(['Male_Peasant_Body','Male_Ranger_Legs','Male_Ranger_Arms','Male_Ranger_Feet_Boots'].map(n=>load('assets/clothing/'+n+'.gltf').then(g=>g.scene)));
const args=process.argv.slice(2);
function option(name){const i=args.indexOf(name);if(i<0)return null;if(!args[i+1]||args[i+1].startsWith('--'))throw new Error('Missing '+name+' value');return args[i+1];}
for(let i=0;i<args.length;i+=2)if(!['--preset','--output'].includes(args[i]))throw new Error('Unknown option '+args[i]);
const presetFile=option('--preset');
const custom=presetFile?importPreset(await fs.readFile(path.resolve(presetFile),'utf8')):null;
const jobs=custom?[{name:'DeathCustom',preset:custom}]:['chest','blast'].map(type=>({name:type==='chest'?'DeathChest':'DeathBlast',preset:exportPreset(type,defaultSettings(type))}));
const output={format:1,engine:'cannon-es@0.20.0',fps:30,physicsHz:360,clips:[],diagnostics:{},presets:{}};
if(process.env.RAGDOLL_PROOF_DIR)await fs.mkdir(process.env.RAGDOLL_PROOF_DIR,{recursive:true});
for(const {name,preset} of jobs){
 const visual=createRifleman(reference.scene,'desert',garments);
 calibrateRiflemanWeapon(visual,library.animations.find(c=>c.name==='Pistol_Idle_Loop'));
 const simulation=simulateRagdoll({THREE,C,visual,idleClip:library.animations.find(c=>c.name==='Idle_Loop'),settings:preset.settings,name});
 let result;
 while(true){
  const step=simulation.next();if(step.done){result=step.value;break;}
  if(process.env.RAGDOLL_PROOF_DIR&&[0,6,15,27,Math.round(preset.settings.duration*30)].includes(step.value.frame)){
   const meshes=[];visual.traverse(mesh=>{if(!mesh.isMesh||!mesh.visible)return;const g=mesh.geometry,p=g.attributes.position,vertices=[],colors=[],v=new THREE.Vector3(),material=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
    for(let i=0;i<p.count;i++){if(mesh.isSkinnedMesh)mesh.getVertexPosition(i,v);else v.fromBufferAttribute(p,i);vertices.push(v.applyMatrix4(mesh.matrixWorld).toArray());const c=g.attributes.color?new THREE.Color().fromBufferAttribute(g.attributes.color,i).multiply(material.color):material.color;colors.push(c.toArray());}
    meshes.push({vertices,colors,indices:g.index?Array.from(g.index.array):Array.from({length:p.count},(_,i)=>i)});
   });await fs.writeFile(path.join(process.env.RAGDOLL_PROOF_DIR,name+'-'+step.value.frame+'.json'),JSON.stringify(meshes));
  }
 }
 output.clips.push(result.clip);output.diagnostics[name]=result.diagnostics;output.presets[name]=preset;
 console.log(name,'end',JSON.stringify(result.diagnostics[preset.settings.duration.toFixed(2)]),'max anchor error',result.diagnostics.maxAnchorError.toFixed(5),'m');
}
const destination=option('--output')?path.resolve(option('--output')):path.join(repo,'assets/animations/'+(custom?'custom-ragdoll.json':'ragdoll-deaths.json'));
await fs.writeFile(destination,JSON.stringify(output));
console.log('Saved '+destination+'; physics engine is not included in game playback.');
