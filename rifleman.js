import * as THREE from 'https://esm.sh/three@0.169.0';
import {clone as cloneSkeleton} from 'https://esm.sh/three@0.169.0/examples/jsm/utils/SkeletonUtils.js';
import {RoundedBoxGeometry} from 'https://esm.sh/three@0.169.0/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'https://esm.sh/three@0.169.0/examples/jsm/utils/BufferGeometryUtils.js';

const PALETTES={
 desert:{cloth:'#998165',plate:'#c5aa86',edge:'#e0c6a1',webbing:'#73634f',rubber:'#303231',metal:'#444b4b',skin:'#bd9175'},
 dark:{cloth:'#444c40',plate:'#545d50',edge:'#78816a',webbing:'#303a32',rubber:'#222a2b',metal:'#353e40',skin:'#bd9175'}
};

// Fit in the reference model's unanimated coordinate system, then express every
// rigid part in its bone frame. Direct UAL tracks remain entirely unmodified.
export function createRifleman(template,paletteName){
 const root=cloneSkeleton(template),palette=PALETTES[paletteName],ownedGeometries=[],ownedMaterials=[];
 root.updateMatrixWorld(true);
 const bodyMeshes=[];root.traverse(o=>{if(o.isSkinnedMesh)bodyMeshes.push(o)});
 const body=bodyMeshes.find(o=>o.name==='SuperHero_Male');
 if(!body)throw new Error('Quaternius body mesh missing');
 const skeleton=body.skeleton,parts=[];
 // Original face UVs remain on the head. The suit uses a restrained cloth color;
 // masks come from the existing skin influences, never from animated world height.
 const bodyGeometry=body.geometry.clone();ownedGeometries.push(bodyGeometry);
 const weights=bodyGeometry.getAttribute('skinWeight'),indices=bodyGeometry.getAttribute('skinIndex');
 const mask=new Float32Array(weights.count),colors=new Float32Array(weights.count*3);
 const cloth=new THREE.Color(palette.cloth),rubber=new THREE.Color(palette.rubber);
 for(let i=0;i<weights.count;i++){
  let skin=0,boot=0;
  for(let j=0;j<4;j++){const name=skeleton.bones[indices.getComponent(i,j)]?.name||'',w=weights.getComponent(i,j);if(/^(Head|neck_01)$/.test(name))skin+=w;if(/^(foot|ball)/.test(name))boot+=w;}
  mask[i]=skin;const c=cloth.clone().lerp(rubber,boot);c.toArray(colors,i*3);
 }
 bodyGeometry.setAttribute('color',new THREE.BufferAttribute(colors,3));bodyGeometry.setAttribute('faceMask',new THREE.BufferAttribute(mask,1));body.geometry=bodyGeometry;
 const bodyMaterial=new THREE.MeshStandardMaterial({map:body.material.map,vertexColors:true,roughness:.95});
 bodyMaterial.onBeforeCompile=shader=>{
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float faceMask; varying float vFaceMask;').replace('#include <begin_vertex>','#include <begin_vertex>\nvFaceMask=faceMask;');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float vFaceMask;').replace('#include <map_fragment>',`#ifdef USE_MAP
   vec4 sampledDiffuseColor=texture2D(map,vMapUv);
   diffuseColor.rgb=mix(diffuseColor.rgb,sampledDiffuseColor.rgb,smoothstep(.25,.85,vFaceMask));
  #endif`);
 };
 body.material=bodyMaterial;ownedMaterials.push(bodyMaterial);
 // Hair is covered by the helmet. Eyes retain the source material and UVs.
 for(const m of bodyMeshes){if(m.name==='Eyebrows')m.visible=false;m.castShadow=true;m.receiveShadow=true;m.frustumCulled=false;}
 const gearMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.78,metalness:.12});ownedMaterials.push(gearMaterial);
 const position=new THREE.Vector3(),rotation=new THREE.Euler(),quaternion=new THREE.Quaternion(),scale=new THREE.Vector3(1,1,1),matrix=new THREE.Matrix4();
 function attach(boneName,geometry,color,xyz,angles=[0,0,0]){
  const bone=root.getObjectByName(boneName);if(!bone)throw new Error('Missing equipment bone '+boneName);
  // Parts are merged into one skinned draw with rigid, single-bone weights.
  const g=geometry.index?geometry.toNonIndexed():geometry.clone();geometry.dispose();
  position.fromArray(xyz);rotation.set(...angles);quaternion.setFromEuler(rotation);matrix.compose(position,quaternion,scale);g.applyMatrix4(matrix);
  const count=g.attributes.position.count,c=new THREE.Color(palette[color]||color),rgb=new Float32Array(count*3),si=new Uint16Array(count*4),sw=new Float32Array(count*4),boneIndex=skeleton.bones.indexOf(bone);
  for(let i=0;i<count;i++){c.toArray(rgb,i*3);si[i*4]=boneIndex;sw[i*4]=1;}
  g.setAttribute('color',new THREE.BufferAttribute(rgb,3));g.setAttribute('skinIndex',new THREE.BufferAttribute(si,4));g.setAttribute('skinWeight',new THREE.BufferAttribute(sw,4));parts.push(g);
 }
 function plate(bone,size,xyz,color='plate',angles){attach(bone,new RoundedBoxGeometry(...size,1,.012),color,xyz,angles)}
 function ellipsoid(bone,size,xyz,color='plate',start=0,length=Math.PI){const g=new THREE.SphereGeometry(1,16,10,0,Math.PI*2,start,length);g.scale(...size);attach(bone,g,color,xyz)}
 // Layered plate carrier, straps, webbing, magazine pouches and compact pack.
 plate('spine_03',[.35,.34,.13],[0,1.31,.105],'webbing');
 plate('spine_03',[.29,.27,.085],[0,1.33,.19]);
 plate('spine_03',[.23,.035,.015],[0,1.39,.239],'edge');
 for(const x of [-.135,.135])plate('spine_03',[.055,.17,.055],[x,1.49,.055],'webbing');
 for(const x of [-.10,0,.10]){plate('spine_02',[.085,.13,.065],[x,1.16,.18],'webbing');plate('spine_02',[.071,.025,.012],[x,1.205,.218],'edge');}
 plate('spine_03',[.28,.32,.13],[0,1.32,-.18],'webbing');
 plate('spine_03',[.23,.21,.07],[0,1.33,-.265]);
 plate('pelvis',[.32,.07,.22],[0,.99,-.025],'webbing');plate('pelvis',[.065,.047,.025],[0,.99,.095],'metal');
 for(const side of ['l','r']){
  const s=side==='l'?1:-1;
  plate('upperarm_'+side,[.18,.12,.23],[s*.235,1.45,-.06]);
  plate('upperarm_'+side,[.145,.025,.18],[s*.24,1.514,-.06],'edge');
  plate('lowerarm_'+side,[.12,.12,.17],[s*.535,1.455,-.065],'webbing');
  plate('lowerarm_'+side,[.13,.065,.13],[s*.49,1.49,-.065]);
  plate('thigh_'+side,[.15,.25,.085],[s*.12,.80,.055]);
  plate('thigh_'+side,[.17,.08,.105],[s*.12,.91,.005],'webbing');
  plate('calf_'+side,[.155,.17,.10],[s*.114,.535,.02]);
  plate('calf_'+side,[.12,.24,.065],[s*.114,.36,.018]);
  plate('foot_'+side,[.18,.09,.29],[s*.114,.055,.01],'rubber');
  plate('foot_'+side,[.165,.075,.13],[s*.114,.11,.08]);
 }
 // Helmet is an actual open-bottom shell; goggles and ear protection hide hair.
 ellipsoid('Head',[.126,.125,.131],[0,1.739,-.013],'plate',0,Math.PI*.60);
 plate('Head',[.24,.028,.065],[0,1.745,.11]);
 plate('Head',[.064,.045,.028],[0,1.795,.107],'metal');
 for(const x of [-.126,.126])plate('Head',[.035,.095,.08],[x,1.69,-.018],'webbing');
 plate('Head',[.205,.065,.042],[0,1.695,.119],'rubber');
 for(const x of [-.052,.052])plate('Head',[.084,.042,.018],[x,1.698,.147],'metal');
 // Weapon follows the right palm. The support hand is solved in preview only.
 const hand=root.getObjectByName('hand_r');
 const weapon=new THREE.Group();weapon.name='RiflemanWeapon';hand.add(weapon);
 // Build in palm-local coordinates so the weapon never floats off the hand.
 const weaponMat=new THREE.MeshStandardMaterial({color:palette.metal,roughness:.6,metalness:.5});ownedMaterials.push(weaponMat);
 const stockMat=new THREE.MeshStandardMaterial({color:palette.webbing,roughness:.85});ownedMaterials.push(stockMat);
 function weaponBox(size,xyz,mat=weaponMat){const g=new RoundedBoxGeometry(...size,1,.006),m=new THREE.Mesh(g,mat);m.position.fromArray(xyz);m.castShadow=true;weapon.add(m);ownedGeometries.push(g);return m}
 weaponBox([.065,.10,.26],[0,.065,.08]);weaponBox([.075,.075,.15],[0,.065,-.12],stockMat);
 weaponBox([.055,.065,.18],[0,.065,.27],stockMat);weaponBox([.03,.035,.20],[0,.08,.44]);
 weaponBox([.045,.12,.065],[0,-.035,.085],stockMat).rotation.x=.25;
 weaponBox([.03,.04,.07],[0,.13,.08]);weaponBox([.05,.09,.045],[0,-.02,-.015],stockMat);
 // An explicit grip target is useful when fitting aim poses; no guessed wrist correction.
 const supportGrip=new THREE.Object3D();supportGrip.name='RiflemanSupportGrip';supportGrip.position.set(0,.035,.27);weapon.add(supportGrip);
 const gearGeometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());ownedGeometries.push(gearGeometry);
 const gear=new THREE.SkinnedMesh(gearGeometry,gearMaterial);gear.name='RiflemanArmor';root.add(gear);gear.bind(skeleton,body.bindMatrix);gear.castShadow=true;gear.receiveShadow=true;gear.frustumCulled=false;
 root.userData.rifleman={palette:paletteName,weapon,supportGrip,ownedGeometries,ownedMaterials};
 return root;
}

export function disposeRifleman(root){const r=root.userData.rifleman;if(!r)return;for(const g of r.ownedGeometries)g.dispose();for(const m of r.ownedMaterials)m.dispose();}

// Fit the rifle to the native pistol-ready wrist frame, rather than guessing
// its orientation from the T-pose. Sampling is temporary and restores the bind pose.
export function calibrateRiflemanWeapon(root,readyClip){
 const bones=[];root.traverse(o=>{if(o.isBone)bones.push([o,o.position.clone(),o.quaternion.clone(),o.scale.clone()])});
 const mixer=new THREE.AnimationMixer(root);mixer.clipAction(readyClip).play();mixer.setTime(.4);root.updateMatrixWorld(true);
 const wrist=root.getObjectByName('hand_r'),q=wrist.getWorldQuaternion(new THREE.Quaternion());
 root.userData.rifleman.weapon.quaternion.copy(q.invert());
 mixer.stopAllAction();mixer.uncacheRoot(root);
 for(const [b,p,q,s] of bones){b.position.copy(p);b.quaternion.copy(q);b.scale.copy(s)}root.updateMatrixWorld(true);
}

// Optional support-hand fitting layer over UAL pistol-ready clips. Keep base
// locomotion and Death untouched; this does not modify the shared source clips.
export function updateRiflemanGrip(root){
 const grip=root.userData.rifleman.supportGrip,wrist=root.getObjectByName('hand_l');
 const target=new THREE.Vector3(),origin=new THREE.Vector3(),end=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3();
 const delta=new THREE.Quaternion(),parentQ=new THREE.Quaternion(),worldQ=new THREE.Quaternion();
 root.updateMatrixWorld(true);grip.getWorldPosition(target);
 for(let iteration=0;iteration<8;iteration++)for(const name of ['lowerarm_l','upperarm_l']){
  const joint=root.getObjectByName(name);joint.getWorldPosition(origin);wrist.getWorldPosition(end);
  a.copy(end).sub(origin).normalize();b.copy(target).sub(origin).normalize();delta.setFromUnitVectors(a,b);
  joint.getWorldQuaternion(worldQ);joint.parent.getWorldQuaternion(parentQ);
  joint.quaternion.copy(parentQ.invert().multiply(delta).multiply(worldQ));root.updateMatrixWorld(true);
 }
 // Align the support palm with the weapon, while retaining an articulated wrist.
 const weaponQ=root.userData.rifleman.weapon.getWorldQuaternion(new THREE.Quaternion());
 wrist.parent.getWorldQuaternion(parentQ);wrist.quaternion.copy(parentQ.invert().multiply(weaponQ));
 root.updateMatrixWorld(true);
}
