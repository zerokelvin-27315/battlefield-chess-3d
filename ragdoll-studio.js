import * as THREE from 'https://esm.sh/three@0.169.0';
import * as C from 'https://esm.sh/cannon-es@0.20.0';
import {OrbitControls} from 'https://esm.sh/three@0.169.0/examples/jsm/controls/OrbitControls.js';
import {GLTFLoader} from 'https://esm.sh/three@0.169.0/examples/jsm/loaders/GLTFLoader.js';
import {createRifleman,calibrateRiflemanWeapon,disposeRifleman} from './rifleman.js?v=0.9.8-preview';
import {defaultSettings,validateSettings,exportPreset,importPreset,simulateRagdoll,TARGETS} from './ragdoll-simulation.js?v=0.9.7-preview';
import {seekPreviewClip} from './death-sequences.js?v=0.9.6-preview';

const $=id=>document.getElementById(id),clone=value=>structuredClone(value);
const STORAGE_KEY='battlefield-ragdoll-studio-v1';
const presetNames={chest:'Chest launch · two squares',blast:'Leg blast · face first',collapse:'Unpowered collapse'};
let draft=exportPreset(presetNames.chest,defaultSettings()),completedPreset=null,completedResult=null,dirty=true;
let reference,garments,library,cached,actor=null,mixer=null,action=null,wrapper=null,scale=1;
let playing=false,playTime=0,busy=false,runToken=0,ready=false,fieldCounter=0;
const actors=new Map(),frameBounds=new THREE.Box3();
let pathLine=null,landingMarker=null,currentView='perspective';
const setStatus=(message,error=false)=>{$('status').textContent=message;$('status').classList.toggle('error',error)};
const fingerprint=preset=>JSON.stringify(exportPreset(preset.name,preset.settings));
const presetText=()=>JSON.stringify(completedPreset,null,2);

function make(tag,text,attributes={}){const node=document.createElement(tag);if(text!==null)node.textContent=text;for(const [key,value] of Object.entries(attributes))node.setAttribute(key,value);return node;}
function control(parent,label,min,max,step,value,onChange){
 const row=make('div',null,{class:'control'}),id='field-'+(++fieldCounter),caption=make('label',label,{for:id});
 const number=make('input',null,{type:'number',min,max,step,id}),range=make('input',null,{type:'range',min,max,step,'aria-label':label});number.value=value;range.value=value;
 number.addEventListener('input',()=>{range.value=number.value;onChange(number.value===''?NaN:Number(number.value));markDirty()});
 range.addEventListener('input',()=>{number.value=range.value;onChange(Number(range.value));markDirty()});
 row.append(caption,number,range);parent.append(row);return row;
}
function vectorControls(parent,values,prefix,limit,step){for(const [i,axis] of ['X · sideways','Y · upward','Z · forward'].entries())control(parent,prefix+' '+axis,-limit,limit,step,values[i],v=>values[i]=v)}
const targetLabels={chest:'Chest',head:'Head',pelvis:'Pelvis',abdomen:'Abdomen',calves:'Both calves',feet:'Both feet',arm_l:'Left upper arm',arm_r:'Right upper arm',forearm_l:'Left forearm',forearm_r:'Right forearm',hand_l:'Left hand',hand_r:'Right hand',thigh_l:'Left thigh',thigh_r:'Right thigh',calf_l:'Left calf',calf_r:'Right calf',foot_l:'Left foot',foot_r:'Right foot'};
function renderImpacts(){
 const container=$('impacts');container.replaceChildren();
 if(!draft.settings.impacts.length)container.append(make('p','No hits. Gravity and body momentum still apply.',{class:'hint'}));
 draft.settings.impacts.forEach((event,index)=>{
  const card=make('div',null,{class:'impact'}),heading=make('div',null,{class:'impact-heading'}),select=make('select',null,{'aria-label':'Hit '+(index+1)+' body'});
  for(const target of TARGETS){const option=make('option',(index+1)+'. '+targetLabels[target],{value:target});select.append(option)}select.value=event.target;
  select.onchange=()=>{event.target=select.value;markDirty()};
  const remove=make('button','Remove',{'aria-label':'Remove hit '+(index+1)});remove.onclick=()=>{draft.settings.impacts.splice(index,1);renderImpacts();markDirty()};heading.append(select,remove);card.append(heading);
  vectorControls(card,event.impulse,'Impulse',300,1);
  const advanced=make('details'),summary=make('summary','Timing & hit offset');advanced.append(summary);
  control(advanced,'Hit time (s)',0,8,.01,event.at,v=>event.at=v);
  control(advanced,'Impulse duration (s)',1/30,.5,.001,event.duration,v=>event.duration=v);
  const hint=make('p','Hit offset is measured from the body’s center in its local frame. An off-center hit adds spin.',{class:'hint'});advanced.append(hint);
  vectorControls(advanced,event.offset,'Offset (m)',.3,.01);card.append(advanced);container.append(card);
 });
 $('addImpact').disabled=draft.settings.impacts.length>=8||busy;
}
function renderSettings(){
 $('sequenceName').value=draft.name;renderImpacts();
 $('momentumControls').replaceChildren();vectorControls($('momentumControls'),draft.settings.momentum,'Velocity (m/s)',10,.1);
 control($('momentumControls'),'Launch duration (s)',1/30,.5,.001,draft.settings.momentumDuration,v=>draft.settings.momentumDuration=v);
 const physics=$('physicsControls');physics.replaceChildren();
 for(const [label,key,min,max,step] of [['Duration (s)','duration',1,8,.1],['Gravity (m/s²)','gravity',0,25,.1],['Floor friction','friction',0,1.5,.01],['Floor bounce','restitution',0,.6,.01],['Linear damping','linearDamping',0,.95,.01],['Angular damping','angularDamping',0,.99,.01],['Joint flexibility','jointFlexibility',.4,1.6,.05]])control(physics,label,min,max,step,draft.settings[key],v=>draft.settings[key]=v);
 $('releaseWeapon').checked=draft.settings.releaseWeapon;$('weaponControls').replaceChildren();control($('weaponControls'),'Rifle release time (s)',0,8,.01,draft.settings.weaponReleaseTime,v=>draft.settings.weaponReleaseTime=v);
 updatePresetHighlight();
}
function updatePresetHighlight(){for(const button of document.querySelectorAll('[data-preset]'))button.classList.toggle('active',JSON.stringify(draft.settings)===JSON.stringify(validateSettings(defaultSettings(button.dataset.preset))))}
function persistDraft(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify(exportPreset(draft.name,draft.settings)))}catch{/* Private browsing and full storage do not block the studio. */}}
function markDirty(){
 try{const validated=exportPreset(draft.name,draft.settings);dirty=!completedPreset||fingerprint(validated)!==fingerprint(completedPreset);persistDraft();setStatus(dirty?'Settings changed. Simulate to preview and copy them.':'Preview matches these settings.');}
 catch(error){dirty=true;setStatus(error.message,true)}
 $('copySettings').disabled=busy||dirty||!completedPreset;$('downloadSettings').disabled=busy||dirty||!completedPreset;updatePresetHighlight();
}
$('sequenceName').oninput=()=>{draft.name=$('sequenceName').value;markDirty()};
$('releaseWeapon').onchange=()=>{draft.settings.releaseWeapon=$('releaseWeapon').checked;markDirty()};
$('addImpact').onclick=()=>{if(draft.settings.impacts.length>=8)return;draft.settings.impacts.push({at:0,duration:.06,target:'chest',impulse:[0,50,-30],offset:[0,0,0]});renderImpacts();markDirty()};

let renderer,scene,camera,controls;
try{
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.75));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.3;$('canvas').append(renderer.domElement);
 scene=new THREE.Scene();scene.fog=new THREE.Fog('#243642',12,30);
 camera=new THREE.PerspectiveCamera(38,1,.02,70);camera.position.set(4,2.7,4);
 controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.target.set(0,.4,-.8);controls.minDistance=.6;controls.maxDistance=24;controls.maxPolarAngle=Math.PI*.495;
 scene.add(new THREE.HemisphereLight('#dbecf5','#575b50',2.5));const sun=new THREE.DirectionalLight('#fff1d7',3.8);sun.position.set(-3,7,4);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-8;sun.shadow.camera.right=8;sun.shadow.camera.top=8;sun.shadow.camera.bottom=-8;sun.shadow.bias=-.0003;scene.add(sun);
 const rim=new THREE.DirectionalLight('#b2d5ed',1.4);rim.position.set(3,4,-5);scene.add(rim);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(60,60),new THREE.MeshStandardMaterial({color:'#45534d',roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;ground.position.y=-.003;scene.add(ground);
 const grid=new THREE.GridHelper(20,20,'#a3b3ae','#718179');grid.material.transparent=true;grid.material.opacity=.35;grid.position.y=.001;scene.add(grid);
 const origin=new THREE.Mesh(new THREE.RingGeometry(.10,.125,40),new THREE.MeshBasicMaterial({color:'#9bdfca',side:THREE.DoubleSide}));origin.rotation.x=-Math.PI/2;origin.position.y=.004;scene.add(origin);
 function label(text,x,z){const canvas=document.createElement('canvas');canvas.width=192;canvas.height=64;const ctx=canvas.getContext('2d');ctx.fillStyle='#c7dad8';ctx.font='24px system-ui';ctx.textAlign='center';ctx.fillText(text,96,40);const texture=new THREE.CanvasTexture(canvas),sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,opacity:.8}));sprite.position.set(x,.015,z);sprite.scale.set(.7,.23,1);scene.add(sprite)}
 label('START',.6,.25);for(let i=1;i<=5;i++)label('−'+i+' SQ',.55,-i);
 new ResizeObserver(()=>{const {width,height}=$('canvas').getBoundingClientRect();if(!width||!height)return;renderer.setSize(width,height);camera.aspect=width/height;camera.updateProjectionMatrix()}).observe($('canvas'));
}catch(error){$('loadMessage').textContent='3D rendering could not start: '+error.message;throw error;}

// Match the game normalizer, including independent bind matrices and refitting.
function normalize(root){
 const b=new THREE.Box3().setFromObject(root,true),size=b.getSize(new THREE.Vector3()),center=b.getCenter(new THREE.Vector3()),group=new THREE.Group();let factor=1.1/size.y;
 group.position.set(-center.x*factor,0,-center.z*factor);group.scale.setScalar(factor);group.add(root);
 const skinned=[];root.traverse(o=>{if(o.isSkinnedMesh&&o.skeleton)skinned.push(o)});
 const rebind=()=>{group.updateMatrixWorld(true);for(const skeleton of new Set(skinned.map(o=>o.skeleton)))skeleton.calculateInverses();for(const mesh of skinned)mesh.bind(mesh.skeleton,mesh.matrixWorld);group.updateMatrixWorld(true)};
 rebind();for(let i=0;i<3;i++){const actual=new THREE.Box3().setFromObject(root,true).getSize(new THREE.Vector3());if(!Number.isFinite(actual.y)||actual.y<.001)break;const correction=1.1/actual.y;if(Math.abs(correction-1)<.005)break;group.scale.multiplyScalar(correction);factor*=correction;rebind()}
 group.position.y=.005;return {group,factor};
}
function createVisual(palette){const visual=createRifleman(reference,palette,garments);calibrateRiflemanWeapon(visual,library.animations.find(c=>c.name==='Pistol_Idle_Loop'));return visual;}
function selectActor(){
 if(!ready)return;
 const palette=$('palette').value;
 if(wrapper)scene.remove(wrapper);if(mixer){mixer.stopAllAction();mixer.uncacheRoot(actor)}
 if(!actors.has(palette)){const visual=createVisual(palette),rig=normalize(visual);actors.set(palette,{visual,...rig})}
 const selected=actors.get(palette);actor=selected.visual;wrapper=selected.group;scale=selected.factor;scene.add(wrapper);mixer=new THREE.AnimationMixer(actor);
 if(completedResult){action=mixer.clipAction(THREE.AnimationClip.parse(completedResult.clip));action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true;action.play();seek(playTime);drawPath()}else action=null;
}
function seek(time){
 if(!action)return;playTime=Math.max(0,Math.min(action.getClip().duration,time));seekPreviewClip(mixer,action,playTime);wrapper.updateMatrixWorld(true);$('timeline').value=playTime;$('time').textContent=playTime.toFixed(2)+' / '+action.getClip().duration.toFixed(2)+' s';
}
function setPlaying(value){playing=value;$('play').textContent=value?'Pause':'Play'}
function drawPath(){
 if(pathLine){scene.remove(pathLine);pathLine.geometry.dispose();pathLine.material.dispose();pathLine=null}if(landingMarker){scene.remove(landingMarker);landingMarker.geometry.dispose();landingMarker.material.dispose();landingMarker=null}
 if(!completedResult)return;
 const positions=completedResult.trajectory||Object.entries(completedResult.diagnostics).filter(([k])=>/^\d/.test(k)).map(([,d])=>d.pelvis);
 const points=positions.map(p=>new THREE.Vector3(p[0]*scale+wrapper.position.x,.01,p[2]*scale+wrapper.position.z));
 pathLine=new THREE.Line(new THREE.BufferGeometry().setFromPoints(points),new THREE.LineBasicMaterial({color:'#b6ead7',transparent:true,opacity:.8}));pathLine.visible=$('showPath').checked;scene.add(pathLine);
 const end=points.at(-1);landingMarker=new THREE.Mesh(new THREE.RingGeometry(.12,.15,40),new THREE.MeshBasicMaterial({color:'#e6bf8d',side:THREE.DoubleSide}));landingMarker.rotation.x=-Math.PI/2;landingMarker.position.copy(end);landingMarker.visible=$('showPath').checked;scene.add(landingMarker);
}
function measureBounds(){
 const previous=playTime;frameBounds.makeEmpty();for(const t of [0,.2,.5,1,action.getClip().duration]){seek(t);frameBounds.union(new THREE.Box3().setFromObject(actor,true))}seek(previous);
}
function fitCamera(view=currentView){
 if(!action)return;currentView=view;measureBounds();
 const center=frameBounds.getCenter(new THREE.Vector3()),size=frameBounds.getSize(new THREE.Vector3()),radius=Math.max(.9,size.length()*.5);
 const vertical=THREE.MathUtils.degToRad(camera.fov),horizontal=2*Math.atan(Math.tan(vertical/2)*camera.aspect),distance=radius/Math.sin(Math.min(vertical,horizontal)/2)*1.13;
 const directions={perspective:new THREE.Vector3(1,.65,1),side:new THREE.Vector3(1,.18,0),front:new THREE.Vector3(0,.23,1),top:new THREE.Vector3(0,1,.001)};
 controls.target.copy(center);camera.position.copy(center).addScaledVector(directions[view].normalize(),distance);controls.update();
 document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
}
function showResult(result,preset,{autoplay=true}={}){
 completedResult=result;completedPreset=clone(preset);dirty=false;playTime=0;selectActor();$('timeline').max=result.clip.duration;
 const d=result.diagnostics,start=d['0.00'].pelvis,end=d[result.clip.duration.toFixed(2)].pelvis,back=(start[2]-end[2])*scale,side=(end[0]-start[0])*scale;
 $('result').textContent=(back>=0?'Back ':'Forward ')+Math.abs(back).toFixed(2)+' squares · sideways '+Math.abs(side).toFixed(2)+' · '+result.clip.duration.toFixed(2)+' s';
 $('presetJson').value=presetText();$('exportStatus').textContent='Copy these settings and paste them into our chat.';
 for(const id of ['replay','play','timeline'])$(id).disabled=false;
 markDirty();seek(0);fitCamera();setPlaying(autoplay);
}
function busyUI(value){
 busy=value;$('simulate').disabled=value||!ready;$('cancel').hidden=!value;$('progress').hidden=!value;
 for(const node of document.querySelectorAll('#panel input:not(#presetJson),#panel select,#panel [data-preset],#panel #addImpact,#panel .impact button,#importSettings'))node.disabled=value;
 $('addImpact').disabled=value||draft.settings.impacts.length>=8;
 $('copySettings').disabled=value||dirty||!completedPreset;$('downloadSettings').disabled=value||dirty||!completedPreset;
}
async function simulate(){
 if(busy||!ready)return;
 let preset;try{preset=exportPreset(draft.name,draft.settings)}catch(error){setStatus(error.message,true);return}
 const token=++runToken;busyUI(true);setPlaying(false);$('progress').value=0;setStatus('Simulating… 0%');
 let visual,simulation;
 try{
  await new Promise(requestAnimationFrame);visual=createVisual('desert');simulation=simulateRagdoll({THREE,C,visual,idleClip:library.animations.find(c=>c.name==='Idle_Loop'),settings:preset.settings,name:'DeathCustom'});
  let step;
  do{
   if(token!==runToken)return;
   step=simulation.next();
   if(!step.done){$('progress').value=step.value.progress;setStatus('Simulating… '+Math.round(step.value.progress*100)+'%');await new Promise(requestAnimationFrame)}
  }while(!step.done);
  if(token!==runToken)return;
  showResult(step.value,preset);setStatus('Ready. Replay, scrub, or copy these settings.');
 }catch(error){if(token===runToken)setStatus('Simulation failed: '+error.message,true)}
 finally{simulation?.return();if(visual)disposeRifleman(visual);if(token===runToken)busyUI(false)}
}
$('simulate').onclick=simulate;
$('cancel').onclick=()=>{++runToken;busyUI(false);setStatus('Simulation cancelled. Previous preview retained.');markDirty()};
$('play').onclick=()=>{if(!action||busy)return;if(playTime>=action.getClip().duration)seek(0);setPlaying(!playing)};
$('replay').onclick=()=>{if(busy)return;seek(0);setPlaying(true)};
$('timeline').oninput=()=>{setPlaying(false);seek(Number($('timeline').value))};
$('palette').onchange=()=>{selectActor()};
$('showPath').onchange=()=>{if(pathLine)pathLine.visible=$('showPath').checked;if(landingMarker)landingMarker.visible=$('showPath').checked};
$('frameView').onclick=()=>fitCamera();document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>fitCamera(b.dataset.view));
$('panelToggle').onclick=()=>{const hidden=document.body.classList.toggle('panel-hidden');$('panelToggle').textContent=hidden?'Show settings':'Hide settings';$('panelToggle').setAttribute('aria-expanded',String(!hidden))};
document.querySelectorAll('[data-preset]').forEach(button=>button.onclick=()=>{
 if(busy||!ready)return;const type=button.dataset.preset;draft=exportPreset(presetNames[type],defaultSettings(type));renderSettings();persistDraft();
 if(type==='collapse'){markDirty();return}
 const name=type==='chest'?'DeathChest':'DeathBlast',clip=cached.clips.find(c=>c.name===name);showResult({clip,diagnostics:cached.diagnostics[name]},draft);
});
$('copySettings').onclick=async()=>{
 if(dirty||!completedPreset)return;$('presetJson').value=presetText();$('exportStatus').classList.remove('error');
 try{await navigator.clipboard.writeText(presetText());$('exportStatus').textContent='Copied. Paste this JSON into our chat.'}
 catch{$('presetJson').focus();$('presetJson').select();$('exportStatus').textContent='Select and copy the JSON above, then paste it into our chat.'}
};
$('downloadSettings').onclick=()=>{
 if(dirty||!completedPreset)return;const url=URL.createObjectURL(new Blob([presetText()],{type:'application/json'})),a=make('a',null,{href:url,download:(completedPreset.name.replace(/[^a-z0-9]+/gi,'-').replace(/^-|-$/g,'')||'ragdoll-preset')+'.json'});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
};
$('importSettings').onclick=()=>{
 if(busy)return;
 try{draft=importPreset($('presetJson').value);renderSettings();markDirty();$('exportStatus').textContent='Preset imported. Simulating…';$('exportStatus').classList.remove('error');simulate()}
 catch(error){$('exportStatus').textContent='Import failed: '+error.message;$('exportStatus').classList.add('error')}
};

let previous=performance.now();
function render(now){
 const dt=Math.min(.1,(now-previous)/1000);previous=now;
 if(playing&&action&&!busy){const duration=action.getClip().duration,next=playTime+dt*Number($('speed').value);if(next>=duration){if($('loop').checked)seek(next%duration);else{seek(duration);setPlaying(false)}}else seek(next)}
 controls.update();renderer.render(scene,camera);requestAnimationFrame(render);
}
requestAnimationFrame(render);
async function load(){
 try{
  const loader=new GLTFLoader(),manager=loader.manager;let resources=0;manager.onProgress=()=>{$('loadMessage').textContent='Loading character assets… '+(++resources)+' files'};
  const models=await Promise.all([loader.loadAsync('./assets/reference/scene.gltf'),loader.loadAsync('./assets/animations/UAL1_Standard.glb'),...['Male_Peasant_Body','Male_Ranger_Legs','Male_Ranger_Arms','Male_Ranger_Feet_Boots'].map(n=>loader.loadAsync('./assets/clothing/'+n+'.gltf')),fetch('./assets/animations/ragdoll-deaths.json?v=0.9.6-preview').then(r=>{if(!r.ok)throw new Error('Animation presets could not load');return r.json()})]);
  reference=models[0].scene;library=models[1];garments=models.slice(2,6).map(g=>g.scene);cached=models[6];ready=true;
  let saved=null;try{saved=localStorage.getItem(STORAGE_KEY)}catch{}
  draft=exportPreset(presetNames.chest,defaultSettings());renderSettings();selectActor();showResult({clip:cached.clips.find(c=>c.name==='DeathChest'),diagnostics:cached.diagnostics.DeathChest},draft,{autoplay:false});
  try{if(saved){draft=importPreset(saved);renderSettings();markDirty()}}catch{/* Ignore obsolete or invalid saved drafts. */}
  busyUI(false);$('loading').hidden=true;
 }catch(error){$('loading').querySelector('strong').textContent='The studio could not load';$('loadMessage').textContent=error.message+' Reload this page to retry.';setStatus(error.message,true)}
}
renderSettings();load();
