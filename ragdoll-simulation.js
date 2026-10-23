// Shared deterministic authoring engine. Dependencies are injected so Node and
// browser use the same Three.js and Cannon-es versions without duplicate modules.
export const ENGINE='cannon-es@0.20.0';
export const PRESET_FORMAT='battlefield-ragdoll-preset';
export const TARGETS=['chest','head','pelvis','abdomen','calves','feet','arm_l','arm_r','forearm_l','forearm_r','hand_l','hand_r','thigh_l','thigh_r','calf_l','calf_r','foot_l','foot_r'];
const impact=(target,impulse)=>({at:0,duration:.06,target,impulse,offset:[0,0,0]});
const common={duration:3.6,gravity:9.81,friction:.7,restitution:0,linearDamping:.25,angularDamping:.78,jointFlexibility:1,releaseWeapon:true,weaponReleaseTime:.16,momentum:[0,0,0],momentumDuration:.06};
export function defaultSettings(preset='chest'){
 if(!['chest','blast','collapse'].includes(preset))throw new Error('Unknown preset');
 return structuredClone({...common,...(preset==='chest'?{momentum:[0,0,-4.9],impacts:[impact('chest',[0,145,-65])]}:preset==='blast'?{impacts:[impact('calves',[0,8,-32]),impact('feet',[0,3,-12])]}:{impacts:[]})});
}
function bounded(value,min,max,label){if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max)throw new Error(label+' must be between '+min+' and '+max);return value;}
function vector(value,limit,label){if(!Array.isArray(value)||value.length!==3)throw new Error(label+' must contain X, Y, Z');return value.map(n=>bounded(n,-limit,limit,label));}
export function validateSettings(value){
 if(!value||typeof value!=='object')throw new Error('Missing settings');
 const s={};
 for(const [key,min,max] of [['duration',1,8],['gravity',0,25],['friction',0,1.5],['restitution',0,.6],['linearDamping',0,.95],['angularDamping',0,.99],['jointFlexibility',.4,1.6],['weaponReleaseTime',0,8],['momentumDuration',1/30,.5]])s[key]=bounded(value[key],min,max,key);
 s.duration=Math.round(s.duration*30)/30;
 if(typeof value.releaseWeapon!=='boolean')throw new Error('releaseWeapon must be true or false');s.releaseWeapon=value.releaseWeapon;
 s.momentum=vector(value.momentum,10,'momentum');
 if(!Array.isArray(value.impacts)||value.impacts.length>8)throw new Error('Use up to eight impacts');
 s.impacts=value.impacts.map(e=>{
  if(!e||!TARGETS.includes(e.target))throw new Error('Unknown impact body');
  if(e.at>=s.duration)throw new Error('Each impact must start before the sequence ends');
  return {at:bounded(e.at,0,8,'impact time'),duration:bounded(e.duration,1/30,.5,'impact duration'),target:e.target,impulse:vector(e.impulse,300,'impulse'),offset:vector(e.offset,.3,'offset')};
 });
 return s;
}
export function exportPreset(name,settings){return {format:PRESET_FORMAT,version:1,engine:ENGINE,name:String(name||'Custom death').slice(0,80),settings:validateSettings(settings)};}
export function importPreset(value){
 const p=typeof value==='string'?JSON.parse(value):value;
 if(!p||p.format!==PRESET_FORMAT||p.version!==1||p.engine!==ENGINE)throw new Error('Use a Battlefield ragdoll preset, version 1 / '+ENGINE);
 return exportPreset(p.name,p.settings);
}

export function* simulateRagdoll({THREE,C,visual,idleClip,settings=defaultSettings(),name='DeathCustom'}){
 settings=validateSettings(settings);
 const v3=v=>new THREE.Vector3(v.x,v.y,v.z),cv=v=>new C.Vec3(v.x,v.y,v.z),tq=q=>new THREE.Quaternion(q.x,q.y,q.z,q.w);
 const position=bone=>bone.getWorldPosition(new THREE.Vector3());
 const bindPose=new Map();visual.traverse(b=>{if(b.isBone)bindPose.set(b.name,{p:b.position.clone(),q:b.quaternion.clone(),s:b.scale.clone()})});
 const startMixer=new THREE.AnimationMixer(visual);startMixer.clipAction(idleClip).play();startMixer.setTime(0);visual.updateMatrixWorld(true);
 // Use a balanced standing stance, keeping the relaxed idle arms. The source
 // idle's staggered legs can turn a symmetric blast into an unintended side fall.
 visual.traverse(b=>{if(b.isBone&&/^(root|pelvis|spine|neck|Head|thigh|calf|foot|ball)/.test(b.name)){const pose=bindPose.get(b.name);b.position.copy(pose.p);b.quaternion.copy(pose.q);b.scale.copy(pose.s)}});visual.updateMatrixWorld(true);
 const root=visual.getObjectByName('root'),pelvis=visual.getObjectByName('pelvis');
 root.position.y-=new THREE.Box3().setFromObject(visual,true).min.y;visual.updateMatrixWorld(true);
 const rootStart=root.position.clone(),bones=[];visual.traverse(b=>{if(b.isBone)bones.push(b)});
 const faceLocal=new THREE.Vector3(0,0,1).applyQuaternion(visual.getObjectByName('Head').getWorldQuaternion(new THREE.Quaternion()).invert());
 const world=new C.World({gravity:new C.Vec3(0,-settings.gravity,0)});world.solver.iterations=80;world.solver.tolerance=1e-8;
 world.defaultContactMaterial.friction=settings.friction;world.defaultContactMaterial.restitution=settings.restitution;
 world.defaultContactMaterial.contactEquationStiffness=1e8;world.defaultContactMaterial.contactEquationRelaxation=4;
 const floor=new C.Body({mass:0,shape:new C.Plane(),collisionFilterGroup:1,collisionFilterMask:2});floor.quaternion.setFromEuler(-Math.PI/2,0,0);world.addBody(floor);
 const bodies=new Map(),drivers=new Map(),constraints=[];
 function body(id,center,half,mass,orientation=new THREE.Quaternion()){
  const physical=new C.Body({mass,position:cv(center),quaternion:new C.Quaternion(...orientation.toArray()),linearDamping:settings.linearDamping,angularDamping:settings.angularDamping,collisionFilterGroup:2,collisionFilterMask:1});
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
  const constraint=new C.ConeTwistConstraint(A,B,{pivotA:A.pointToLocalFrame(point),pivotB:B.pointToLocalFrame(point),axisA:A.vectorToLocalFrame(axis),axisB:B.vectorToLocalFrame(axis),angle:Math.min(Math.PI,angle*settings.jointFlexibility),twistAngle:Math.min(Math.PI,twist*settings.jointFlexibility),collideConnected:false,maxForce:1e8});
  // Calibrate a common twist reference in the authored pose. Generating an
  // arbitrary tangent independently in each differently oriented body frame
  // can preload the joint with a 180-degree twist and inject spurious energy.
  const referenceAxis=new C.Vec3(0,0,1),tangentA=A.vectorToLocalFrame(referenceAxis),tangentB=B.vectorToLocalFrame(referenceAxis),baseUpdate=constraint.update.bind(constraint);
  constraint.update=()=>{baseUpdate();A.vectorToWorldFrame(tangentA,constraint.twistEquation.axisA);B.vectorToWorldFrame(tangentB,constraint.twistEquation.axisB)};
  for(const equation of constraint.equations)equation.setSpookParams(1e9,3,1/360);world.addConstraint(constraint);constraints.push(constraint);
 }
 joint('pelvis','abdomen','spine_01',.32,.22);joint('abdomen','chest','spine_03',.40,.25);joint('chest','head','neck_01',.55,.5);
 for(const s of ['l','r']){joint('chest','arm_'+s,'upperarm_'+s,1.3,.65);joint('arm_'+s,'forearm_'+s,'lowerarm_'+s,1.3,.10);joint('forearm_'+s,'hand_'+s,'hand_'+s,.55,.4);joint('pelvis','thigh_'+s,'thigh_'+s,.45,.12);joint('thigh_'+s,'calf_'+s,'calf_'+s,1.3,.08);joint('calf_'+s,'foot_'+s,'foot_'+s,.45,.12);}
 // Settings use the same fixed-step solver in the browser and offline baker.
 const targets=target=>target==='calves'?['calf_l','calf_r']:target==='feet'?['foot_l','foot_r']:[target];
 function impact(){
  const dt=1/360,time=world.time;
  for(const event of settings.impacts){
   if(time<event.at||time>=event.at+event.duration)continue;
   for(const id of targets(event.target)){
    const physical=bodies.get(id),fraction=dt/event.duration;
    const point=physical.quaternion.vmult(new C.Vec3(...event.offset));
    physical.applyImpulse(new C.Vec3(...event.impulse.map(n=>n*fraction)),point);
   }
  }
  if(time<settings.momentumDuration)for(const [id,physical] of bodies){
   if(id==='weapon')continue;
   physical.applyImpulse(new C.Vec3(...settings.momentum.map(n=>physical.mass*n*(dt/settings.momentumDuration))));
  }
 }
 const weapon=visual.userData.rifleman.weapon,weaponOffset=new THREE.Vector3(0,.04,.16);let weaponBody=null;
 function releaseWeapon(){if(!settings.releaseWeapon||weaponBody||world.time<settings.weaponReleaseTime)return;visual.updateMatrixWorld(true);
  const q=weapon.getWorldQuaternion(new THREE.Quaternion()),center=weapon.localToWorld(weaponOffset.clone());
  weaponBody=body('weapon',center,[.05,.085,.36],2.8,q);weaponBody.velocity.copy(bodies.get('hand_r').velocity);weaponBody.angularVelocity.copy(bodies.get('hand_r').angularVelocity);
 }
 const channels=new Map(),frames=[],duration=settings.duration,diagnostics={},trajectory=[];
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
 for(let frame=0;frame<=Math.round(duration*30);frame++){
  if(frame)for(let step=0;step<12;step++){impact();releaseWeapon();world.step(1/360);}
  pose();const time=frame/30;frames.push(time);
  for(const bone of bones)for(const property of ['quaternion','position','scale'])channels.get(bone.name+'.'+property).push(...bone[property].toArray());channels.get('RiflemanWeapon.position').push(...weapon.position.toArray());channels.get('RiflemanWeapon.quaternion').push(...weapon.quaternion.toArray());
  for(const constraint of constraints){const a=constraint.bodyA.pointToWorldFrame(constraint.pivotA),b=constraint.bodyB.pointToWorldFrame(constraint.pivotB);maxAnchorError=Math.max(maxAnchorError,a.distanceTo(b));}
  trajectory.push(position(pelvis).toArray());
  if([0,3,6,9,18,30,Math.round(duration*30)].includes(frame)){const headBone=visual.getObjectByName('Head'),head=position(headBone),chest=position(visual.getObjectByName('spine_03')),feet=['l','r'].map(s=>position(visual.getObjectByName('foot_'+s)));diagnostics[time.toFixed(2)]={head:head.toArray(),chest:chest.toArray(),pelvis:position(pelvis).toArray(),feet:feet.map(p=>p.toArray()),faceDirection:faceLocal.clone().applyQuaternion(headBone.getWorldQuaternion(new THREE.Quaternion())).toArray()};}
  yield {frame,time,progress:frame/Math.round(duration*30)};
 }
 const tracks=[];for(const [name,values] of channels){const size=name.endsWith('.quaternion')?4:3,constant=values.every((value,i)=>Math.abs(value-values[i%size])<1e-7),times=constant?[0]:frames,data=constant?values.slice(0,size):values;tracks.push(size===4?new THREE.QuaternionKeyframeTrack(name,times,data):new THREE.VectorKeyframeTrack(name,times,data));}
 const clip=new THREE.AnimationClip(name,duration,tracks);const json=THREE.AnimationClip.toJSON(clip);
 delete json.uuid;
 // A compact export is reproducible and still well within float precision for
 // model-space translations/quaternions. Quaternions normalize on playback.
 for(const track of json.tracks){track.times=track.times.map(n=>+n.toFixed(6));track.values=track.values.map(n=>+n.toFixed(6));}
 diagnostics.maxMeshCorrection=maxCorrection;diagnostics.maxAnchorError=maxAnchorError;
 return {clip:json,diagnostics,trajectory,settings};
}

