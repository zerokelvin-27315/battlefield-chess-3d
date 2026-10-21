import * as THREE from 'https://esm.sh/three@0.169.0';
import {clone as cloneSkeleton} from 'https://esm.sh/three@0.169.0/examples/jsm/utils/SkeletonUtils.js';
import {RoundedBoxGeometry} from 'https://esm.sh/three@0.169.0/examples/jsm/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'https://esm.sh/three@0.169.0/examples/jsm/utils/BufferGeometryUtils.js';

const PALETTES={
 desert:{cloth:'#998165',plate:'#c5aa86',edge:'#e0c6a1',webbing:'#73634f',rubber:'#303231',metal:'#444b4b',skin:'#bd9175'},
 dark:{cloth:'#444c40',plate:'#545d50',edge:'#78816a',webbing:'#303a32',rubber:'#222a2b',metal:'#353e40',skin:'#bd9175'}
};

// SkeletonUtils clones bones and skeleton objects, but Three.js 0.169.0 keeps
// the inverse-bind array shared. Normalizing/rebinding one actor must never
// overwrite the template or another actor's bind transforms.
export function cloneRig(template){
 const root=cloneSkeleton(template),seen=new Set();
 root.traverse(o=>{if(o.isSkinnedMesh&&!seen.has(o.skeleton)){
  seen.add(o.skeleton);
  o.skeleton.boneInverses=o.skeleton.boneInverses.map(matrix=>matrix.clone());
 }});
 return root;
}

// Fit in the reference model's unanimated coordinate system, then express every
// rigid part in its bone frame. Direct UAL tracks remain entirely unmodified.
export function createRifleman(template,paletteName,garments=[]){
 const root=cloneRig(template),palette=PALETTES[paletteName],ownedGeometries=[],ownedMaterials=[];
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
 if(garments.length){
  // Outfits include their own body coverage. Keep just the original head/neck,
  // compacting all attributes so precise bounds also exclude the hidden body.
  const kept=[],position=bodyGeometry.attributes.position,index=bodyGeometry.index;
  const count=index?index.count:position.count;
  for(let i=0;i<count;i+=3){const tri=[0,1,2].map(j=>index?index.getX(i+j):i+j);if(tri.every(v=>position.getY(v)>1.47))kept.push(...tri);}
  const head=new THREE.BufferGeometry();
  for(const [name,attribute] of Object.entries(bodyGeometry.attributes)){
   const array=new attribute.array.constructor(kept.length*attribute.itemSize);
   kept.forEach((vertex,i)=>{for(let c=0;c<attribute.itemSize;c++)array[i*attribute.itemSize+c]=attribute.array[vertex*attribute.itemSize+c]});
   head.setAttribute(name,new THREE.BufferAttribute(array,attribute.itemSize,attribute.normalized));
  }
  body.geometry=head;ownedGeometries.push(head);
  fitGarments(root,body,garments,palette,ownedGeometries,ownedMaterials);
 }
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
 function panel(bone,width,height,depth,xyz,color='plate',curve=.025){
  // A sampled shell keeps the bent front smooth instead of bending just the
  // corner vertices of a large flat triangle (which leaves diagonal creases).
  const w=width/2,h=height/2,cut=Math.min(width*.18,height*.16),rows=[-h,-h+cut,h-cut*1.8,h],widths=[w-cut,w,w,w-cut],columns=9,layer=rows.length*columns,vertices=[],indices=[];
  for(let side=0;side<2;side++)for(let r=0;r<rows.length;r++)for(let c=0;c<columns;c++){
   const x=widths[r]*(c/(columns-1)*2-1);vertices.push(x,rows[r],side*depth+curve*(1-(x/w)**2));
  }
  for(let side=0;side<2;side++)for(let r=0;r<rows.length-1;r++)for(let c=0;c<columns-1;c++){
   const a=side*layer+r*columns+c,b=a+1,d=a+columns,e=d+1;indices.push(...(side?[a,b,d,b,e,d]:[a,d,b,b,d,e]));
  }
  const rim=[];for(let c=0;c<columns;c++)rim.push(c);for(let r=1;r<rows.length;r++)rim.push(r*columns+columns-1);for(let c=columns-2;c>=0;c--)rim.push((rows.length-1)*columns+c);for(let r=rows.length-2;r>0;r--)rim.push(r*columns);
  for(let i=0;i<rim.length;i++){const a=rim[i],b=rim[(i+1)%rim.length];indices.push(a,b,a+layer,b,b+layer,a+layer);}
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(vertices.length/3*2),2));geometry.setIndex(indices);geometry.computeVertexNormals();attach(bone,geometry,color,xyz);
 }
 function shoulderStrap(x){
  const path=[[1.35,.16],[1.43,.13],[1.475,.055],[1.475,-.035],[1.43,-.115],[1.35,-.15]],vertices=[],indices=[];
  path.forEach(([y,z],i)=>{const before=path[Math.max(0,i-1)],after=path[Math.min(path.length-1,i+1)],dy=after[0]-before[0],dz=after[1]-before[1],length=Math.hypot(dy,dz),ny=-dz/length*.006,nz=dy/length*.006;vertices.push(x-.025,y+ny,z+nz,x+.025,y+ny,z+nz,x+.025,y-ny,z-nz,x-.025,y-ny,z-nz);});
  for(let i=0;i<path.length-1;i++)for(let edge=0;edge<4;edge++){const a=i*4+edge,b=i*4+(edge+1)%4;indices.push(a,b,a+4,b,b+4,a+4)}
  const end=(path.length-1)*4;indices.push(0,2,1,0,3,2,end,end+1,end+2,end,end+2,end+3);
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(path.length*8),2));g.setIndex(indices);g.computeVertexNormals();attach('spine_03',g,'webbing',[0,0,0]);
  plate('spine_03',[.045,.032,.018],[x,1.405,.143],'metal',[-.3,0,0]);
 }
 // Layered plate carrier, straps, webbing, magazine pouches and compact pack.
 panel('spine_03',.33,.30,.035,[0,1.31,.105],'webbing',.035);
 panel('spine_03',.275,.235,.024,[0,1.325,.15],'plate',.028);
 plate('spine_03',[.12,.023,.012],[0,1.39,.203],'webbing');
 for(const x of [-.127,.127])shoulderStrap(x);
 for(const x of [-.085,0,.085]){plate('spine_02',[.072,.112,.045],[x,1.165,.165],'webbing');plate('spine_02',[.06,.02,.012],[x,1.205,.194],'plate');}
 for(const y of [1.27,1.30])plate('spine_03',[.21,.009,.008],[0,y,.204],'webbing');
 // Compact, tapered daypack with two pockets and compression webbing.
 panel('spine_03',.25,.285,.07,[0,1.31,-.235],'webbing',-.025);
 for(const x of [-.06,.06]){
  plate('spine_03',[.103,.10,.045],[x,1.235,-.267],'webbing');
  plate('spine_03',[.095,.018,.048],[x,1.277,-.27],'plate');
 }
 for(const x of [-.085,.085])plate('spine_03',[.018,.205,.012],[x,1.335,-.267],'rubber');
 plate('spine_03',[.07,.018,.035],[0,1.459,-.19],'rubber');
 plate('pelvis',[.31,.045,.21],[0,.99,-.025],'webbing');plate('pelvis',[.05,.033,.018],[0,.99,.087],'metal');
 for(const side of ['l','r']){
  const s=side==='l'?1:-1;
  ellipsoid('upperarm_'+side,[.10,.075,.10],[s*.245,1.46,-.055],'plate',0,Math.PI*.62);
  plate('lowerarm_'+side,[.10,.075,.13],[s*.535,1.455,-.065],'webbing');
  panel('lowerarm_'+side,.09,.10,.018,[s*.51,1.45,.005],'plate',.012);
  panel('thigh_'+side,.12,.165,.022,[s*.12,.80,.063],'plate',.018);
  plate('thigh_'+side,[.15,.035,.10],[s*.12,.86,.0],'webbing');
  panel('calf_'+side,.125,.125,.024,[s*.114,.535,.038],'plate',.02);
  panel('calf_'+side,.085,.15,.018,[s*.114,.37,.035],'plate',.012);
  if(!garments.length){
   plate('foot_'+side,[.18,.09,.29],[s*.114,.055,.01],'rubber');
   plate('foot_'+side,[.165,.075,.13],[s*.114,.11,.08]);
  }
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

// Transfer each garment from its authored bind proportions to the existing
// superhero bind pose. Bone names, not array order, define the correspondence.
// Runtime deformation then uses the same skeleton as the head and armor.
function fitGarments(root,body,templates,palette,ownedGeometries,ownedMaterials){
 const target=body.skeleton,boneIndices=new Map(target.bones.map((b,i)=>[b.name,i]));
 const targetBindInverse=body.bindMatrix.clone().invert();
 for(const template of templates){template.updateMatrixWorld(true);template.traverse(source=>{
  if(!source.isSkinnedMesh)return;
  let geometry=source.geometry.clone();const positions=geometry.attributes.position,normals=geometry.attributes.normal;
  const sourceIndices=geometry.attributes.skinIndex,weights=geometry.attributes.skinWeight;
  const indices=new Uint16Array(sourceIndices.count*4),transforms=source.skeleton.bones.map((bone,i)=>{
   const mapped=boneIndices.get(bone.name);if(mapped===undefined)throw new Error('Unmapped garment joint '+bone.name);
   return new THREE.Matrix4().copy(targetBindInverse).multiply(target.bones[mapped].matrixWorld).multiply(source.skeleton.boneInverses[i]).multiply(source.bindMatrix);
  });
  const vertex=new THREE.Vector3(),normal=new THREE.Vector3(),p=new THREE.Vector3(),n=new THREE.Vector3(),outP=new THREE.Vector3(),outN=new THREE.Vector3();
  for(let i=0;i<positions.count;i++){
   vertex.fromBufferAttribute(positions,i);normal.fromBufferAttribute(normals,i);outP.set(0,0,0);outN.set(0,0,0);
   for(let j=0;j<4;j++){const src=sourceIndices.getComponent(i,j),w=weights.getComponent(i,j);indices[i*4+j]=boneIndices.get(source.skeleton.bones[src].name);if(!w)continue;outP.addScaledVector(p.copy(vertex).applyMatrix4(transforms[src]),w);outN.addScaledVector(n.copy(normal).transformDirection(transforms[src]),w);}
   // Tailor only fitted garment vertices; retain the authored skin influences.
   if(source.name.includes('Legs')&&outP.y<.65){const t=THREE.MathUtils.smoothstep(outP.y,.42,.65);outP.y-=.20*(1-t);}
   if(source.name.includes('Peasant_Body')&&outP.y<1.06){outP.y=THREE.MathUtils.mapLinear(outP.y,.86,1.06,.98,1.06);outP.x*=.94;outP.z*=.94;}
   positions.setXYZ(i,outP.x,outP.y,outP.z);outN.normalize();normals.setXYZ(i,outN.x,outN.y,outN.z);
  }
  geometry.setAttribute('skinIndex',new THREE.BufferAttribute(indices,4));
  if(source.name.includes('Feet')){
   // Remove the tall fantasy boot shafts. Trouser cuffs overlap the opening.
   const index=geometry.index,kept=[],count=index?index.count:positions.count,groups=[];
   for(let i=0;i<count;i+=3){const tri=[0,1,2].map(j=>index?index.getX(i+j):i+j);if(tri.every(v=>positions.getY(v)<.295)){
    const materialIndex=geometry.groups.find(g=>i>=g.start&&i<g.start+g.count)?.materialIndex||0;
    const last=groups.at(-1);if(last?.materialIndex===materialIndex)last.count+=3;else groups.push({start:kept.length,count:3,materialIndex});kept.push(...tri);
   }}
   const cropped=new THREE.BufferGeometry();
   for(const [name,attribute] of Object.entries(geometry.attributes)){const array=new attribute.array.constructor(kept.length*attribute.itemSize);kept.forEach((v,i)=>{for(let c=0;c<attribute.itemSize;c++)array[i*attribute.itemSize+c]=attribute.array[v*attribute.itemSize+c]});cropped.setAttribute(name,new THREE.BufferAttribute(array,attribute.itemSize,attribute.normalized));}
   for(const group of groups)cropped.addGroup(group.start,group.count,group.materialIndex);geometry.dispose();geometry=cropped;
  }
  geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();ownedGeometries.push(geometry);
  const sourceMaterials=Array.isArray(source.material)?source.material:[source.material];
  const materials=sourceMaterials.map(original=>{
   const material=original.clone(),boots=source.name.includes('Feet');material.color.set(boots?palette.rubber:palette.cloth);material.roughness=.9;material.metalness=0;
   material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
    vec4 sampledDiffuseColor=texture2D(map,vMapUv);
    float detail=dot(sampledDiffuseColor.rgb,vec3(.2126,.7152,.0722));
    diffuseColor.rgb*=mix(.45,1.35,detail);
   #endif`)};
   material.customProgramCacheKey=()=> 'rifleman-clothing-v1';ownedMaterials.push(material);return material;
  });
  const mesh=new THREE.SkinnedMesh(geometry,Array.isArray(source.material)?materials:materials[0]);mesh.name='Uniform_'+source.name;root.add(mesh);mesh.bind(target,body.bindMatrix);mesh.castShadow=true;mesh.receiveShadow=true;mesh.frustumCulled=false;
 })}
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
