// npm ci --prefix tools/ragdoll && npm run bake --prefix tools/ragdoll
// Physics is an authoring dependency only. The app loads the baked skeletal clips.
import * as THREE from 'three';
import * as C from 'cannon-es';
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
const v3=v=>new THREE.Vector3(v.x,v.y,v.z),cv=v=>new C.Vec3(v.x,v.y,v.z),tq=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w);
const position=bone=>bone.getWorldPosition(new THREE.Vector3());
const output={format:1,engine:'cannon-es@0.20.0',fps:30,physicsHz:360,clips:[],diagnostics:{}};
if(process.env.RAGDOLL_PROOF_DIR)await fs.mkdir(process.env.RAGDOLL_PROOF_DIR,{recursive:true});
for(const name of ['DeathChest','DeathBlast']){
 const visual=createRifleman(reference.scene,'desert',garments);calibrateRiflemanWeapon(visual,library.animations.find(c=>c.name==='Pistol_Idle_Loop'));
 const bindPose=new Map();visual.traverse(b=>{if(b.isBone)bindPose.set(b.name,{p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()})});
 const startMixer=new THREE.AnimationMixer(visual);startMixer.clipAction(library.animations.find(c=>c.name==='Idle_Loop')).play();startMixer.setTime(0);visual.updateMatrixWorld(true);
 // Use a balanced standing stance, keeping the relaxed idle arms. The source
 // idle's staggered legs can turn a symmetric blast into an unintended side fall.
 visual.traverse(b=>{if(b.isBone&&/^(root|pelvis|spine|neck|Head|thigh|calf|foot|ball)/.test(b.name)){const pose=bindPose.get(b.name);b.position.copy(pose.p);b.quaternion.copy(pose.q);b.scale.copy(pose.s)}});visual.updateMatrixWorld(true);
 const root=visual.getObjectByName('root'),pelvis=visual.getObjectByName('pelvis');
 root.position.y-=new THREE.Box3().setFromObject(visual,true).min.y;visual.updateMatrixWorld(true);
 const rootStart=root.position.clone(),bones=[];visual.traverse(b=>{if(b.isBone)bones.push(b)});
 const faceLocal=new THREE.Vector3(0,0,1).applyQuaternion(visual.getObjectByName('Head').getWorldQuaternion(new THREE.Quaternion()).invert());
 const world=new C.World({gravity:new C.Vec3(0,-9.81,0)});world.solver.iterations=80;world.solver.tolerance=1e-8;
 world.defaultContactMaterial.friction=.7;world.defaultContactMaterial.restitution=0;
 world.defaultContactMaterial.contactEquationStiffness=1e8;world.defaultContactMaterial.contactEquationRelaxation=4;
 const floor=new C.Body({mass:0,shape:new C.Plane(),collisionFilterGroup:1,collisionFilterMask:2});floor.quaternion.setFromEuler(-Math.PI/2,0,0);world.addBody(floor);
 const bodies=new Map(),drivers=new Map(),constraints=[];
 function body(id,center,half,mass,orientation=new THREE.Quaternion()){
  const physical=new C.Body({mass,position:cv(center),quaternion:new C.Quaternion(...orientation.toArray()),linearDamping:.25,angularDamping:.78,collisionFilterGroup:2,collisionFilterMask:1});
  physical.addShape(new C.Box(new C.Vec3(...half)));world.addBody(physical);bodies.set(id,physical);return physical;
 }
 function drive(boneName,id){const bone=visual.getObjectByName(boneName),physical=bodies.get(id);drivers.set(boneName,{physical,offset:tq(physical.quaternion).invert().multiply(bone.getWorldQuaternion(new THREE.Quaternion()))});}
 function segment(id,from,to,width,depth,mass){const a=position(visual.getObjectByName(from)),b=position(visual.getObjectByName(to));body(id,a.clone().add(b).multiplyScalar(.5),[width/2,a.distanceTo(b)/2,depth/2],mass,new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize()));drive(from,id);}
 const hip=position(pelvis),spine=position(visual.getObjectByName('spine_03')),neck=position(visual.getObjectByName('neck_01'));
 body('pelvis',hip,[.15,.105,.10],12);drive('pelvis','pelvis');
 body('abdomen',hip.clone().add(spine).multiplyScalar(.5),[.145,hip.distanceTo(spine)/2,.115],10);drive('spine_01','abdomen');drive('spine_02','abdomen');
 body('chest',spine.clone().add(neck).multiplyScalar(.5),[.17,spine.distanceTo(neck)/2,.15],17);drive('spine_03','chest');
 bodies.get('chest').addShape(new C.Box(new C.Vec3(.115,.11,.065)),new C.Vec3(0,-.06,-.17));
 const headCenter=position(visual.getObjectByName('Head')).add(new THREE.Vector3(0,.07,0));
 body('head',headCenter,[.115,.125,.12],5);drive('neck_01','head');drive('Head','head');
 for(const side of ['l','r']){
  drive('clavicle_'+side,'chest');segment('arm_'+side,'upperarm_'+side,'lowerarm_'+side,.105,.115,3);
  segment('forearm_'+side,'lowerarm_'+side,'hand_'+side,.085,.09,2);
  const hand=visual.getObjectByName('hand_'+side);body('hand_'+side,position(hand),[.045,.065,.04],1,hand.getWorldQuaternion(new THREE.Quaternion()));drive('hand_'+side,'hand_'+side);
  segment('thigh_'+side,'thigh_'+side,'calf_'+side,.15,.16,7);segment('calf_'+side,'calf_'+side,'foot_'+side,.105,.12,4);
  const foot=visual.getObjectByName('foot_'+side);body('foot_'+side,position(foot).add(new THREE.Vector3(0,-.015,.06)),[.075,.06,.13],1.5);drive('foot_'+side,'foot_'+side);
 }
 function joint(a,b,boneName,angle,twist){
  const A=bodies.get(a),B=bodies.get(b),point=cv(position(visual.getObjectByName(boneName))),axis=new C.Vec3(0,1,0);
  const constraint=new C.ConeTwistConstraint(A,B,{pivotA:A.pointToLocalFrame(point),pivotB:B.pointToLocalFrame(point),axisA:A.vectorToLocalFrame(axis),axisB:B.vectorToLocalFrame(axis),angle,twistAngle:twist,collideConnected:false,maxForce:1e8});
  // Calibrate a common twist reference in the authored pose. Generating an
  // arbitrary tangent independently in each differently oriented body frame
  // can preload the joint with a 180-degree twist and inject spurious energy.
  const referenceAxis=new C.Vec3(0,0,1),tangentA=A.vectorToLocalFrame(referenceAxis),tangentB=B.vectorToLocalFrame(referenceAxis),baseUpdate=constraint.update.bind(constraint);
  constraint.update=()=>{baseUpdate();A.vectorToWorldFrame(tangentA,constraint.twistEquation.axisA);B.vectorToWorldFrame(tangentB,constraint.twistEquation.axisB)};
  for(const equation of constraint.equations)equation.setSpookParams(1e9,3,1/360);world.addConstraint(constraint);constraints.push(constraint);
 }
 joint('pelvis','abdomen','spine_01',.32,.22);joint('abdomen','chest','spine_03',.40,.25);joint('chest','head','neck_01',.55,.5);
 for(const s of ['l','r']){joint('chest','arm_'+s,'upperarm_'+s,1.3,.65);joint('arm_'+s,'forearm_'+s,'lowerarm_'+s,1.3,.10);joint('forearm_'+s,'hand_'+s,'hand_'+s,.55,.4);joint('pelvis','thigh_'+s,'thigh_'+s,.45,.12);joint('thigh_'+s,'calf_'+s,'calf_'+s,1.3,.08);joint('calf_'+s,'foot_'+s,'foot_'+s,.45,.12);}
 // Spread each impact over 60 ms to keep constraint errors bounded while the
 // impacted body visibly moves first. The integrated impulse is unchanged.
 function impact(){if(world.time>=.06)return;const fraction=(1/360)/.06;
  if(name==='DeathChest'){
   bodies.get('chest').applyImpulse(new C.Vec3(0,145*fraction,-65*fraction));
   // Carry the full body backwards without adding a second chest torque.
   // 4.9 m/s in source-rig space gives a two-square pelvis displacement
   // after the production 1.10 m preview normalization (one square = 1 unit).
   for(const physical of bodies.values())physical.applyImpulse(new C.Vec3(0,0,-physical.mass*4.9*fraction));
  }
  else for(const s of ['l','r']){bodies.get('calf_'+s).applyImpulse(new C.Vec3(0,8*fraction,-32*fraction));bodies.get('foot_'+s).applyImpulse(new C.Vec3(0,3*fraction,-12*fraction));}
 }
 const weapon=visual.userData.rifleman.weapon,weaponOffset=new THREE.Vector3(0,.04,.16);let weaponBody=null;
 function releaseWeapon(){if(weaponBody||world.time<.16)return;visual.updateMatrixWorld(true);
  const q=weapon.getWorldQuaternion(new THREE.Quaternion()),center=weapon.localToWorld(weaponOffset.clone());
  weaponBody=body('weapon',center,[.05,.085,.36],2.8,q);weaponBody.velocity.copy(bodies.get('hand_r').velocity);weaponBody.angularVelocity.copy(bodies.get('hand_r').angularVelocity);
 }
 const channels=new Map(),frames=[],duration=3.6;
 for(const bone of bones)for(const property of ['quaternion','position','scale'])channels.set(bone.name+'.'+property,[]);channels.set('RiflemanWeapon.position',[]);channels.set('RiflemanWeapon.quaternion',[]);
 let maxCorrection=0,maxAnchorError=0;
 function pose(){
  root.position.copy(rootStart);visual.updateMatrixWorld(true);
  for(const bone of bones){const driver=drivers.get(bone.name);if(!driver)continue;
   if(bone===pelvis)bone.position.copy(bone.parent.worldToLocal(v3(driver.physical.position)));
   bone.quaternion.copy(bone.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(tq(driver.physical.quaternion).multiply(driver.offset)));visual.updateMatrixWorld(true);
  }
  // The collider envelope approximates armor/boots. Bake any residual mesh
  // floor correction into the root track, rather than running vertex scans live.
  let bottom=Infinity;visual.traverse(mesh=>{if(mesh.isSkinnedMesh&&mesh.visible)bottom=Math.min(bottom,new THREE.Box3().setFromObject(mesh,true).min.y)});
  const correction=Math.max(0,-bottom);maxCorrection=Math.max(maxCorrection,correction);root.position.y+=correction;visual.updateMatrixWorld(true);
  if(weaponBody){const q=tq(weaponBody.quaternion),origin=v3(weaponBody.position).sub(weaponOffset.clone().applyQuaternion(q));weapon.position.copy(weapon.parent.worldToLocal(origin));weapon.quaternion.copy(weapon.parent.getWorldQuaternion(new THREE.Quaternion()).invert().multiply(q));visual.updateMatrixWorld(true);}
 }
 for(let frame=0;frame<=duration*30;frame++){
  if(frame)for(let step=0;step<12;step++){impact();releaseWeapon();world.step(1/360);}
  pose();const time=frame/30;frames.push(time);
  for(const bone of bones)for(const property of ['quaternion','position','scale'])channels.get(bone.name+'.'+property).push(...bone[property].toArray());channels.get('RiflemanWeapon.position').push(...weapon.position.toArray());channels.get('RiflemanWeapon.quaternion').push(...weapon.quaternion.toArray());
  for(const constraint of constraints){const a=constraint.bodyA.pointToWorldFrame(constraint.pivotA),b=constraint.bodyB.pointToWorldFrame(constraint.pivotB);maxAnchorError=Math.max(maxAnchorError,a.distanceTo(b));}
  if([0,3,6,9,18,30,108].includes(frame)){const headBone=visual.getObjectByName('Head'),head=position(headBone),chest=position(visual.getObjectByName('spine_03')),feet=['l','r'].map(s=>position(visual.getObjectByName('foot_'+s)));output.diagnostics[name]??={};output.diagnostics[name][time.toFixed(2)]={head:head.toArray(),chest:chest.toArray(),pelvis:position(pelvis).toArray(),feet:feet.map(p=>p.toArray()),faceDirection:faceLocal.clone().applyQuaternion(headBone.getWorldQuaternion(new THREE.Quaternion())).toArray()};}
  if(process.env.RAGDOLL_PROOF_DIR&&[0,6,15,27,108].includes(frame)){
   const meshes=[];visual.traverse(mesh=>{if(!mesh.isMesh||!mesh.visible)return;const g=mesh.geometry,p=g.attributes.position,vertices=[],colors=[],v=new THREE.Vector3(),material=Array.isArray(mesh.material)?mesh.material[0]:mesh.material;
    for(let i=0;i<p.count;i++){if(mesh.isSkinnedMesh)mesh.getVertexPosition(i,v);else v.fromBufferAttribute(p,i);vertices.push(v.applyMatrix4(mesh.matrixWorld).toArray());const c=g.attributes.color?new THREE.Color().fromBufferAttribute(g.attributes.color,i).multiply(material.color):material.color;colors.push(c.toArray());}
    meshes.push({vertices,colors,indices:g.index?Array.from(g.index.array):Array.from({length:p.count},(_,i)=>i)});
   });await fs.writeFile(path.join(process.env.RAGDOLL_PROOF_DIR,name+'-'+frame+'.json'),JSON.stringify(meshes));
  }
 }
 const tracks=[];for(const [name,values] of channels){const size=name.endsWith('.quaternion')?4:3,constant=values.every((value,i)=>Math.abs(value-values[i%size])<1e-7),times=constant?[0]:frames,data=constant?values.slice(0,size):values;tracks.push(size===4?new THREE.QuaternionKeyframeTrack(name,times,data):new THREE.VectorKeyframeTrack(name,times,data));}
 const clip=new THREE.AnimationClip(name,duration,tracks);const json=THREE.AnimationClip.toJSON(clip);
 delete json.uuid;
 // A compact export is reproducible and still well within float precision for
 // model-space translations/quaternions. Quaternions normalize on playback.
 for(const track of json.tracks){track.times=track.times.map(n=>+n.toFixed(6));track.values=track.values.map(n=>+n.toFixed(6));}
 output.clips.push(json);output.diagnostics[name].maxMeshCorrection=maxCorrection;output.diagnostics[name].maxAnchorError=maxAnchorError;
 console.log(name,'end',JSON.stringify(output.diagnostics[name]['3.60']),'max anchor error',maxAnchorError.toFixed(5),'m');
}
await fs.writeFile(path.join(repo,'assets/animations/ragdoll-deaths.json'),JSON.stringify(output));
console.log('Saved baked ragdoll clips; physics engine is not included in browser playback.');
