// Usage: THREE_ROOT=/path/to/node_modules/three node tools/check-rifleman-skinning.mjs
// Uses the actual production builder, normalization function, glTF and UAL clips.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
const repo=path.resolve(import.meta.dirname,'..');
const threeRoot=process.env.THREE_ROOT;
if(!threeRoot)throw new Error('Set THREE_ROOT to the installed three@0.169.0 directory');
const moduleUrl=pathToFileURL(path.resolve(threeRoot,'build/three.module.js')).href;
const examplesUrl=pathToFileURL(path.resolve(threeRoot,'examples/jsm')).href+'/';
const THREE=await import(moduleUrl);
const {GLTFLoader}=await import(examplesUrl+'loaders/GLTFLoader.js');
const {clone:cloneSkeleton}=await import(examplesUrl+'utils/SkeletonUtils.js');
globalThis.ProgressEvent=class{constructor(type,init){Object.assign(this,{type},init)}};
const builder=(await fs.readFile(path.join(repo,'rifleman.js'),'utf8')).replaceAll('https://esm.sh/three@0.169.0/examples/jsm/',examplesUrl).replaceAll('https://esm.sh/three@0.169.0',moduleUrl);
const rifleman=await import('data:text/javascript;base64,'+Buffer.from(builder).toString('base64'));
const main=await fs.readFile(path.join(repo,'main.js'),'utf8');
// Exercise the production normalizer, including the original rebind behavior.
const RIG_PREVIEW_HEIGHT=1.1;
const normalizeRig=eval('('+main.slice(main.indexOf('function normalizeRig('),main.indexOf('\nfunction setRigMeshVisibility'))+')');
async function loadAsset(relative){
 const file=path.join(repo,relative),bytes=await fs.readFile(file);let json;
 if(relative.endsWith('.glb')){const len=bytes.readUInt32LE(12);json=JSON.parse(bytes.subarray(20,20+len));json.buffers[0].uri='data:application/octet-stream;base64,'+bytes.subarray(28+len).toString('base64');}
 else {json=JSON.parse(bytes);for(const buffer of json.buffers)buffer.uri='data:application/octet-stream;base64,'+(await fs.readFile(path.resolve(path.dirname(file),buffer.uri))).toString('base64');}
 // Texture decoding is browser-specific; keep geometry, transforms and skins exact.
 delete json.textures;delete json.images;json.materials=[{}];for(const mesh of json.meshes)for(const p of mesh.primitives)p.material=0;
 return new GLTFLoader().parseAsync(JSON.stringify(json),'');
}
const reference=await loadAsset('assets/reference/scene.gltf');
const library=await loadAsset('assets/animations/UAL1_Standard.glb');
const ready=library.animations.find(c=>c.name==='Pistol_Idle_Loop');
function inverseSnapshot(root){const values=[];root.traverse(o=>{if(o.isSkinnedMesh)values.push(o.skeleton.boneInverses.flatMap(m=>m.toArray()))});return values;}
const originalInverses=inverseSnapshot(reference.scene);
function build(palette,x){const visual=rifleman.createRifleman(reference.scene,palette);rifleman.calibrateRiflemanWeapon(visual,ready);const rig=normalizeRig(visual,x,1);return {visual,...rig};}
function renderedBody(actor){actor.wrapper.updateMatrixWorld(true);const mesh=actor.visual.getObjectByName('SuperHero_Male'),v=new THREE.Vector3(),inverse=actor.wrapper.matrixWorld.clone().invert(),points=[];mesh.skeleton.update();for(let i=0;i<mesh.geometry.attributes.position.count;i++){mesh.getVertexPosition(i,v);v.applyMatrix4(mesh.matrixWorld).applyMatrix4(inverse);assert(v.toArray().every(Number.isFinite));points.push(...v.toArray());}return points;}
const first=build('desert',-.6),beforeSecond=renderedBody(first),second=build('dark',.6);
assert(JSON.stringify(inverseSnapshot(reference.scene))===JSON.stringify(originalInverses),'Building previews must not mutate template inverse bind matrices');
const afterSecond=renderedBody(first);
assert(Math.max(...beforeSecond.map((x,i)=>Math.abs(x-afterSecond[i])))<1e-5,'Building the second palette must not deform the first');
for(const name of ['A_TPose','Idle_Loop','Walk_Loop','Pistol_Idle_Loop','Pistol_Shoot','Death01']){
 const actors=[first,second],mixers=actors.map(a=>new THREE.AnimationMixer(a.visual));
 mixers.forEach(m=>m.clipAction(library.animations.find(c=>c.name===name)).play());
 for(const t of [0,.4,.8,1.2,2]){
  mixers.forEach(m=>m.setTime(t));
  if(name.startsWith('Pistol_'))actors.forEach(a=>rifleman.updateRiflemanGrip(a.visual));
  const a=renderedBody(first),b=renderedBody(second);
  assert(Math.max(...a.map((x,i)=>Math.abs(x-b[i])))<1e-4,`${name}@${t}: palette instances must have identical local deformation`);
  for(const actor of actors){const box=new THREE.Box3().setFromObject(actor.visual,true);assert(box.getSize(new THREE.Vector3()).length()<3,`${name}@${t}: character exploded`);}
 }
 mixers.forEach(m=>m.stopAllAction());console.log('PASS',name,'both palettes, five sample times');
}
for(let i=0;i<3;i++)build(i%2?'dark':'desert',i-1);
assert(JSON.stringify(inverseSnapshot(reference.scene))===JSON.stringify(originalInverses),'Repeated preview rebuilds must preserve the template');
console.log('PASS independent binds, shared template, and repeated preview builds');
