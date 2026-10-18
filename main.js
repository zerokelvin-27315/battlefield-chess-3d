import * as THREE from 'https://esm.sh/three@0.169.0';
import {OrbitControls} from 'https://esm.sh/three@0.169.0/examples/jsm/controls/OrbitControls.js';
import {Chess} from 'https://esm.sh/chess.js@1.0.0';
import {GLTFLoader} from 'https://esm.sh/three@0.169.0/examples/jsm/loaders/GLTFLoader.js';
import {clone as cloneSkeleton} from 'https://esm.sh/three@0.169.0/examples/jsm/utils/SkeletonUtils.js';

const TYPES={p:'Private',r:'Radio operator',n:'Grenadier',b:'Machine gunner',q:'Sniper',k:'General'};
const SYMBOL={w:{p:'♙',r:'♖',n:'♘',b:'♗',q:'♕',k:'♔'},b:{p:'♟',r:'♜',n:'♞',b:'♝',q:'♛',k:'♚'}};
const ANIMS=['idle','highlighted','targeted','moving','attacking','dying'];
const el=id=>document.getElementById(id), status=s=>el('status').textContent=s;
const scene=new THREE.Scene();scene.background=new THREE.Color('#111c25');scene.fog=new THREE.Fog('#111c25',22,49);
const camera=new THREE.PerspectiveCamera(48,innerWidth/innerHeight,.1,120);camera.position.set(10,15,16);
const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;el('view').appendChild(renderer.domElement);
const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.maxPolarAngle=Math.PI/2.07;controls.minDistance=5;controls.maxDistance=32;controls.target.set(0,0,0);
scene.add(new THREE.HemisphereLight(0xbed9f0,0x353021,2.0));const sun=new THREE.DirectionalLight(0xffe7c6,2.5);sun.position.set(7,17,9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-15;sun.shadow.camera.right=15;sun.shadow.camera.top=15;sun.shadow.camera.bottom=-15;scene.add(sun);
const material=(color,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness:.82,metalness});
const mats={rock:material('#4b4a42'),light:material('#747369'),dark:material('#444a46'),white:material('#b3b39f'),black:material('#334553'),weapon:material('#20252a',.45),skin:material('#b88d72'),glow:material('#e6b767')};
const box=(w,h,d,mat)=>new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat),ball=(r,mat)=>new THREE.Mesh(new THREE.SphereGeometry(r,10,8),mat);
const boardGroup=new THREE.Group(),previewGroup=new THREE.Group();scene.add(boardGroup,previewGroup);const squareToWorld=s=>({x:s.charCodeAt(0)-97-3.5,z:3.5-(+s[1]-1)});
const terrain=box(12,.5,12,mats.rock);terrain.position.y=-.34;terrain.receiveShadow=true;boardGroup.add(terrain);
const tileMeshes=[];for(let rank=0;rank<8;rank++)for(let file=0;file<8;file++){const sq=String.fromCharCode(97+file)+(rank+1),p=squareToWorld(sq);const tile=box(.97,.08,.97,(rank+file)%2?mats.dark:mats.light);tile.position.set(p.x,.0,p.z);tile.receiveShadow=true;tile.userData.square=sq;boardGroup.add(tile);tileMeshes.push(tile)}
let seed=42;function rnd(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}
for(let i=0;i<170;i++){const x=(rnd()-.5)*11.5,z=(rnd()-.5)*11.5;if(Math.abs(x)<4.2&&Math.abs(z)<4.2)continue;const rock=new THREE.Mesh(new THREE.DodecahedronGeometry(.07+rnd()*.24,0),material(new THREE.Color().setHSL(.1,.07,.23+rnd()*.15)));rock.position.set(x,-.05,z);rock.rotation.set(rnd(),rnd()*6,rnd());rock.castShadow=true;boardGroup.add(rock)}
// Environment library: all presets share the original 8x8 grid, square centers, and y=.12 piece origin.
const BOARD_STANDARD=Object.freeze({files:8,ranks:8,squareSize:1,centerY:.12,boardExtent:8});
const ENVIRONMENTS=Object.freeze({
 classic:{name:'Classic',sky:'classic'},
 highlands:{name:'Rocky Highlands',sky:'sunset'}
});
const SKYBOXES=Object.freeze({
 classic:{name:'Classic',top:'#111c25',bottom:'#111c25',fog:'#111c25',sun:'#ffe7c6',intensity:2.5},
 sunset:{name:'Sunset',top:'#273953',bottom:'#d89b6b',fog:'#9a8177',sun:'#ffbd7b',intensity:2.8},
 daylight:{name:'Clear Day',top:'#5085b4',bottom:'#b6d2dc',fog:'#a8c1c8',sun:'#fff0cb',intensity:2.5},
 mist:{name:'Mountain Mist',top:'#657987',bottom:'#b5b7b1',fog:'#a1a9a7',sun:'#e5e7e0',intensity:1.8},
 moonlight:{name:'Moonlight',top:'#09152c',bottom:'#27394b',fog:'#1e3040',sun:'#a7c4ef',intensity:1.25}
});
const classicTerrain=new THREE.Group();classicTerrain.name='Classic board geometry';boardGroup.add(classicTerrain);
classicTerrain.add(terrain,...tileMeshes);
for(const obj of [...boardGroup.children])if(obj!==classicTerrain&&obj.isMesh&&obj.geometry?.type==='DodecahedronGeometry')classicTerrain.add(obj);
const highlandsTerrain=new THREE.Group();highlandsTerrain.name='Rocky Highlands environment';boardGroup.add(highlandsTerrain);
const highlandMaterials={
 stone:material('#77766b'),stoneLight:material('#99917c'),stoneDark:material('#54585a'),
 soil:material('#6e6251'),grass:material('#586449'),water:new THREE.MeshStandardMaterial({color:'#437d94',roughness:.28,metalness:.15})
};
let environmentSeed=99173;function environmentRandom(){environmentSeed=(environmentSeed*1664525+1013904223)>>>0;return environmentSeed/4294967296}
function highlandRock(parent,x,y,z,r,mat){
 const m=new THREE.Mesh(new THREE.DodecahedronGeometry(r,0),mat);
 m.position.set(x,y,z);m.rotation.set(environmentRandom()*.5,environmentRandom()*6.28,environmentRandom()*.4);
 m.scale.set(1.1,.5+environmentRandom()*.55,1.05);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;
}
// Square tops stay at the original board height; irregular edges and small details create natural terrain.
const highlandsFoundation=box(8.8,.75,8.8,highlandMaterials.stoneDark);
highlandsFoundation.position.y=-.48;highlandsFoundation.receiveShadow=true;highlandsTerrain.add(highlandsFoundation);
for(let rank=0;rank<8;rank++)for(let file=0;file<8;file++){
 const x=file-3.5,z=3.5-rank;
 const top=box(.99,.08,.99,(file+rank)%2?highlandMaterials.stone:highlandMaterials.stoneLight);
 top.position.set(x,0,z);top.receiveShadow=true;top.userData.square=String.fromCharCode(97+file)+(rank+1);
 highlandsTerrain.add(top);
 // Keep the center clear for chess pieces and mouse/touch picking.
 for(let k=0;k<2;k++){
  const dx=(environmentRandom()-.5)*.75,dz=(environmentRandom()-.5)*.75;
  if(Math.abs(dx)<.28&&Math.abs(dz)<.28)continue;
  const pebble=highlandRock(highlandsTerrain,x+dx,.055,z+dz,.025+environmentRandom()*.045,highlandMaterials.soil);
  pebble.castShadow=false;
 }
}
for(let i=0;i<190;i++){
 const x=(environmentRandom()-.5)*13.8,z=(environmentRandom()-.5)*13.8;
 if(Math.abs(x)<4.15&&Math.abs(z)<4.15)continue;
 highlandRock(highlandsTerrain,x,-.28-environmentRandom()*.25,z,.15+environmentRandom()*.65,
 environmentRandom()>.48?highlandMaterials.stoneDark:highlandMaterials.stone);
}
for(let i=0;i<42;i++){
 const x=(environmentRandom()-.5)*9.1,z=(environmentRandom()-.5)*9.1;
 if(Math.abs(x)<3.95&&Math.abs(z)<3.95)continue;
 const tuft=new THREE.Mesh(new THREE.ConeGeometry(.07,.19,5),highlandMaterials.grass);
 tuft.position.set(x,-.05,z);highlandsTerrain.add(tuft);
}
for(let i=0;i<24;i++){
 const x=(environmentRandom()-.5)*8.5,z=(environmentRandom()-.5)*8.5;
 if(Math.abs(x)<3.9&&Math.abs(z)<3.9)continue;
 highlandRock(highlandsTerrain,x,-.8-environmentRandom()*.55,z,.35+environmentRandom()*.65,highlandMaterials.stoneDark);
}
const skyDome=new THREE.Mesh(new THREE.SphereGeometry(90,24,12),new THREE.ShaderMaterial({
 side:THREE.BackSide,depthWrite:false,uniforms:{topColor:{value:new THREE.Color()},bottomColor:{value:new THREE.Color()}},
 vertexShader:'varying vec3 vPosition; void main(){vPosition=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
 fragmentShader:'varying vec3 vPosition;uniform vec3 topColor;uniform vec3 bottomColor;void main(){float t=smoothstep(-.25,.7,normalize(vPosition).y);gl_FragColor=vec4(mix(bottomColor,topColor,t),1.0);}'
}));scene.add(skyDome);
function setSkybox(id){
 const sky=SKYBOXES[id]||SKYBOXES.sunset;
 skyDome.visible=id!=='classic';
 skyDome.material.uniforms.topColor.value.set(sky.top);
 skyDome.material.uniforms.bottomColor.value.set(sky.bottom);
 scene.background.set(sky.bottom);scene.fog.color.set(sky.fog);
 sun.color.set(sky.sun);sun.intensity=sky.intensity;
}
function setEnvironment(id){
 const chosen=ENVIRONMENTS[id]||ENVIRONMENTS.classic;
 classicTerrain.visible=id==='classic';highlandsTerrain.visible=id==='highlands';
 el('environmentSelect').value=id;
 setSkybox(el('skyboxSelect').value);
}
function initializeEnvironmentUI(){
 const boardSelect=el('environmentSelect'),skySelect=el('skyboxSelect');
 for(const [id,preset] of Object.entries(ENVIRONMENTS))boardSelect.add(new Option(preset.name,id));
 for(const [id,preset] of Object.entries(SKYBOXES))skySelect.add(new Option(preset.name,id));
 boardSelect.addEventListener('change',()=>{skySelect.value=ENVIRONMENTS[boardSelect.value].sky;setEnvironment(boardSelect.value)});
 skySelect.addEventListener('change',()=>setSkybox(skySelect.value));
 boardSelect.value='highlands';skySelect.value='sunset';setEnvironment('highlands');
}
initializeEnvironmentUI();
const previewBase=box(7,.5,5,mats.rock);previewBase.position.set(0,-.35,0);previewBase.receiveShadow=true;previewGroup.add(previewBase);for(let i=0;i<2;i++){const t=box(2.6,.08,3.4,i?mats.dark:mats.light);t.position.set(i?1.5:-1.5,0,0);t.receiveShadow=true;previewGroup.add(t)}
function limb(parent,w,h,d,mat,x,y,z){const pivot=new THREE.Group();pivot.position.set(x,y,z);const mesh=box(w,h,d,mat);mesh.position.y=-h/2;mesh.castShadow=true;pivot.add(mesh);parent.add(pivot);return pivot}
function soldier(type,color){
const root=new THREE.Group(),body=new THREE.Group();root.add(body);
const primary=material(color==='w'?'#8d977d':'#394b53'),armor=material(color==='w'?'#505f50':'#25333b'),fabric=material(color==='w'?'#67745d':'#34444c'),trim=material(color==='w'?'#c5b88d':'#68818c'),rubber=material('#1b2328'),steel=material('#30383e',.65),skin=material(color==='w'?'#b98a68':'#936d55');
const add=(parent,geo,mat,x,y,z,rx=0,ry=0,rz=0)=>{const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.castShadow=true;parent.add(m);return m};
const cube=(parent,w,h,d,mat,x,y,z,rx=0,ry=0,rz=0)=>add(parent,new THREE.BoxGeometry(w,h,d),mat,x,y,z,rx,ry,rz);
const sphere=(parent,r,mat,x,y,z,sx=1,sy=1,sz=1)=>{const m=add(parent,new THREE.SphereGeometry(r,10,8),mat,x,y,z);m.scale.set(sx,sy,sz);return m};
const tube=(parent,r1,r2,len,mat,x,y,z,rx=0,ry=0,rz=0)=>add(parent,new THREE.CylinderGeometry(r1,r2,len,8),mat,x,y,z,rx,ry,rz);
const hips=cube(body,.39,.22,.27,primary,0,.77,0);const torso=cube(body,.47,.51,.29,primary,0,1.1,0);
cube(body,.49,.33,.35,armor,0,1.15,.04);cube(body,.3,.18,.045,trim,0,1.22,.24);
for(const x of [-.15,.15]){cube(body,.12,.16,.075,armor,x,.99,.23);cube(body,.16,.08,.28,armor,x,1.37,0);cube(body,.16,.13,.09,armor,x,.79,.2)}
const neck=tube(body,.11,.11,.14,skin,0,1.47,0);sphere(body,.16,skin,0,1.57,.035,1,.98,.92);
sphere(body,.21,armor,0,1.69,-.01,1.15,.62,1.08);cube(body,.38,.065,.24,armor,0,1.66,.1);
cube(body,.28,.11,.085,rubber,0,1.56,.16);for(const x of [-.083,.083])cube(body,.115,.07,.025,steel,x,1.56,.212);
for(const x of [-.21,.21]){cube(body,.10,.22,.16,armor,x,1.12,.01);cube(body,.12,.16,.08,trim,x,.93,.18)}
const legs=[limb(body,.17,.53,.19,primary,-.125,.72,0),limb(body,.17,.53,.19,primary,.125,.72,0)];
for(const leg of legs){cube(leg,.19,.18,.21,armor,0,-.31,.025);cube(leg,.20,.20,.24,rubber,0,-.48,.075);cube(leg,.22,.095,.33,rubber,0,-.55,.1)}
const arms=[limb(body,.15,.44,.17,primary,-.33,1.35,0),limb(body,.15,.44,.17,primary,.33,1.35,0)];
for(const arm of arms){cube(arm,.20,.19,.20,armor,0,-.07,0);cube(arm,.16,.15,.19,armor,0,-.31,0);sphere(arm,.085,skin,0,-.47,.03)}
// Weapon assembly: each role carries distinct silhouette and equipment.
const weapon=new THREE.Group();weapon.position.set(.29,1.07,.31);body.add(weapon);
const rifle=(length,barrel)=>{cube(weapon,.12,.14,length*.57,steel,0,0,.04);cube(weapon,.13,.10,length*.23,rubber,0,-.02,-length*.30);tube(weapon,barrel,barrel,length*.53,steel,0,.015,length*.42,Math.PI/2);cube(weapon,.07,.22,.11,steel,0,-.17,.04,.25);cube(weapon,.055,.045,.13,rubber,0,.11,.03);};
if(type==='p'){cube(weapon,.11,.13,.28,steel,0,0,.06);cube(weapon,.10,.17,.085,rubber,0,-.13,-.005,.2);tube(weapon,.033,.033,.17,steel,0,.04,.22,Math.PI/2);arms[1].rotation.x=-.5}
if(type==='b'){rifle(.93,.04);cube(weapon,.18,.2,.15,armor,-.12,-.14,.06);cube(body,.23,.21,.13,armor,-.32,1.0,-.12)}
if(type==='q'){rifle(1.20,.029);tube(weapon,.065,.065,.32,rubber,0,.17,.06,Math.PI/2);tube(weapon,.047,.047,.22,steel,0,.015,.72,Math.PI/2);cube(body,.18,.18,.13,armor,.0,1.0,-.22)}
if(type==='k'){cube(weapon,.11,.12,.25,steel,0,0,.05);cube(weapon,.09,.15,.08,rubber,0,-.13,0);cube(body,.34,.17,.16,rubber,0,1.42,.26);for(const x of [-.10,.10])tube(body,.09,.09,.17,steel,x,1.43,.33,Math.PI/2);cube(body,.16,.11,.06,trim,-.22,1.21,.23)}
if(type==='r'){cube(body,.43,.55,.25,armor,0,1.1,-.30);cube(body,.28,.27,.04,steel,0,1.2,-.45);tube(body,.014,.014,.85,steel,.14,1.76,-.40);sphere(body,.045,trim,.14,2.18,-.40);cube(weapon,.22,.17,.12,rubber,0,0,0);cube(weapon,.14,.08,.025,trim,0,.02,.075)}
if(type==='n'){cube(body,.44,.53,.26,steel,0,1.12,-.32);for(const x of [-.15,.15]){tube(body,.12,.14,.45,armor,x,1.10,-.44);tube(body,.08,.08,.10,trim,x,.82,-.44)}cube(weapon,.18,.16,.38,steel,0,0,.14);tube(weapon,.085,.085,.3,steel,0,.02,.42,Math.PI/2);cube(body,.12,.20,.09,armor,-.24,.92,.14)}
const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle=color==='w'?'#d5d4bc':'#253746';ctx.fillRect(0,0,128,128);ctx.fillStyle=color==='w'?'#172b38':'#f3e7d5';ctx.font='bold 91px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(SYMBOL[color][type],64,67);const tex=new THREE.CanvasTexture(canvas);const badge=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,opacity:.7,depthWrite:false}));badge.position.y=2.24;badge.scale.set(.58,.58,1);root.add(badge);
if(type==='p'){legs[0].rotation.x=-.3;legs[1].rotation.x=.3}
root.userData={type,color,body,arms,legs,badge,state:'idle',age:0,dying:false};return root}
let game=new Chess(),actors=new Map(),mode='battle',selected=null,legal=[],busy=false,previewActors=[];const highlights=[];function clearHighlights(){highlights.forEach(x=>boardGroup.remove(x));highlights.length=0}
function mark(sq,color){const p=squareToWorld(sq),m=new THREE.Mesh(new THREE.PlaneGeometry(.86,.86),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.37,depthWrite:false,side:THREE.DoubleSide}));m.rotation.x=-Math.PI/2;m.position.set(p.x,.056,p.z);boardGroup.add(m);highlights.push(m)}
function deathStyleFor(attackerType){return attackerType==='r'?'napalm':attackerType==='n'?'grenade-flip':'fall'}
function setState(actor,state){if(!actor)return;actor.userData.state=state;actor.userData.age=0;actor.userData.dying=state==='dying';if(state==='idle')actor.userData.deathStyle=null}
function syncBoard(){for(const a of actors.values())boardGroup.remove(a);actors.clear();for(let r=0;r<8;r++)for(let f=0;f<8;f++){const sq=String.fromCharCode(97+f)+(r+1),piece=game.get(sq);if(!piece)continue;const a=soldier(piece.type,piece.color),p=squareToWorld(sq);a.position.set(p.x,.12,p.z);a.rotation.y=piece.color==='w'?Math.PI:0;boardGroup.add(a);actors.set(sq,a)}updateTurn()}
function updateTurn(){const turn=game.turn()==='w'?'White':'Black';el('turn').textContent=game.isCheckmate()?`Checkmate! ${turn==='White'?'Black':'White'} wins`:game.isDraw()?'Draw':`${turn} to move${game.isCheck()?' • CHECK':''}`}
function chooseSquare(sq){if(busy||mode!=='battle'||game.isGameOver())return;const piece=game.get(sq);if(selected&&legal.includes(sq)){performMove(selected,sq);return}clearHighlights();for(const a of actors.values())setState(a,'idle');if(piece&&piece.color===game.turn()){selected=sq;legal=game.moves({square:sq,verbose:true}).map(m=>m.to);mark(sq,0x4fb3dc);legal.forEach(s=>mark(s,game.get(s)?0xff684f:0x58cc98));setState(actors.get(sq),'highlighted');status(`${TYPES[piece.type]} selected • ${legal.length} legal moves`)}else{selected=null;legal=[];status('Select a friendly piece')}}
const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();let pointerStart=null;renderer.domElement.addEventListener('pointerdown',e=>pointerStart={x:e.clientX,y:e.clientY});renderer.domElement.addEventListener('pointerup',e=>{if(!pointerStart||Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>7)return;pointerStart=null;if(mode!=='battle')return;mouse.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);raycaster.setFromCamera(mouse,camera);const hits=raycaster.intersectObjects(tileMeshes);if(hits.length)chooseSquare(hits[0].object.userData.square)});
function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms))}function tween(duration,fn){return new Promise(resolve=>{const start=performance.now();function tick(t){const k=Math.min(1,(t-start)/duration);fn(k);if(k<1)requestAnimationFrame(tick);else resolve()}requestAnimationFrame(tick)})}
async function cameraFocus(attacker,defender){const center=attacker.position.clone().add(defender.position).multiplyScalar(.5);center.y=1;const separation=attacker.position.distanceTo(defender.position);const aspect=camera.aspect;const verticalFov=THREE.MathUtils.degToRad(camera.fov);const horizontalFov=2*Math.atan(Math.tan(verticalFov/2)*aspect);const limitingFov=Math.min(verticalFov,horizontalFov);const radius=Math.max(2.7,separation*.65+1.1);const distance=Math.max(10,(radius/Math.sin(limitingFov/2))*1.2);const side=new THREE.Vector3(1,.65,1).normalize();const to=center.clone().addScaledVector(side,distance);const from=camera.position.clone(),targetFrom=controls.target.clone();await tween(700,k=>{const t=k*k*(3-2*k);camera.position.lerpVectors(from,to,t);controls.target.lerpVectors(targetFrom,center,t);controls.update()})}
// Lightweight, role-specific visual combat effects. All effects use Three.js primitives.
async function effect(from,to,type,fromSquare=null,toSquare=null){
const origin=from.position.clone().add(new THREE.Vector3(0,1.2,.32).applyAxisAngle(new THREE.Vector3(0,1,0),from.rotation.y));
const target=to.position.clone().add(new THREE.Vector3(0,1.02,0));
const disposable=[];
function spawn(geometry,material){const mesh=new THREE.Mesh(geometry,material);scene.add(mesh);disposable.push(mesh);return mesh}
function cleanup(){for(const m of disposable){scene.remove(m);m.geometry.dispose();m.material.dispose()}}
function flash(at,color=0xffba63,size=.22){const m=spawn(new THREE.SphereGeometry(size,10,8),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.88,depthWrite:false}));m.position.copy(at);return m}
function streak(a,b,color=0xffd09a,width=.025){const v=b.clone().sub(a),m=spawn(new THREE.CylinderGeometry(width,width,v.length(),6),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.9,depthWrite:false}));m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),v.normalize());return m}
async function blast(at,radius=1){const core=flash(at,0xffa333,.2);const shock=spawn(new THREE.SphereGeometry(1,16,12),new THREE.MeshBasicMaterial({color:0xff7835,transparent:true,opacity:.35,wireframe:true,depthWrite:false}));shock.position.copy(at);await tween(350,k=>{core.scale.setScalar(1+k*radius*5);core.material.opacity=.88*(1-k);shock.scale.setScalar(.2+k*radius);shock.material.opacity=.4*(1-k)})}
try{
if(type==='r'){
status('Radio operator: napalm strike across the lane!');
const vectorAtSquare=s=>{const p=squareToWorld(s);return new THREE.Vector3(p.x,0,p.z)};let cells=[];if(fromSquare&&toSquare){const df=Math.sign(toSquare.charCodeAt(0)-fromSquare.charCodeAt(0)),dr=Math.sign(Number(toSquare[1])-Number(fromSquare[1]));const endFile=toSquare.charCodeAt(0)-97,endRank=Number(toSquare[1]);let file=fromSquare.charCodeAt(0)-97+df,rank=Number(fromSquare[1])+dr;while(file!==endFile||rank!==endRank){cells.push(vectorAtSquare(String.fromCharCode(97+file)+(rank)));file+=df;rank+=dr}cells.push(vectorAtSquare(toSquare))}else{for(let i=1;i<=6;i++)cells.push(from.position.clone().lerp(to.position,i/6))}
const fire=[];for(const point of cells){const ground=point.clone();ground.y=.065;const ring=spawn(new THREE.CircleGeometry(.4,20),new THREE.MeshBasicMaterial({color:0xff6a16,transparent:true,opacity:.68,depthWrite:false,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.copy(ground);fire.push(ring);for(let j=0;j<3;j++){const flame=spawn(new THREE.ConeGeometry(.13-j*.02,.48+j*.08,7),new THREE.MeshBasicMaterial({color:j===0?0xffdd63:j===1?0xff741b:0xd72d12,transparent:true,opacity:.83,depthWrite:false}));flame.position.set(ground.x+(Math.random()-.5)*.2,.27+j*.07,ground.z+(Math.random()-.5)*.2);fire.push(flame)}}
await tween(1700,k=>{fire.forEach((flame,i)=>{if(i%4===0){flame.material.opacity=.68*(1-k*.55);flame.scale.setScalar(1+k*.3)}else{flame.scale.y=.45+.48*(1-k*.55)+Math.sin(performance.now()*.018+i)*.08;flame.material.opacity=.85*(1-k*.55)}})});await blast(target.clone().setY(.08),.65)
}else if(type==='n'){
status('Grenadier: grenade away!');
const groundTarget=to.position.clone().setY(.07);const grenade=spawn(new THREE.SphereGeometry(.13,12,10),new THREE.MeshStandardMaterial({color:0x425345,metalness:.3}));
await tween(800,k=>{grenade.position.lerpVectors(origin,groundTarget,k);grenade.position.y+=Math.sin(k*Math.PI)*Math.max(1.8,origin.distanceTo(groundTarget)*.35);grenade.rotation.x=k*14});
grenade.visible=false;await blast(groundTarget,1.3);
}else if(type==='b'){
status('Machine gunner: suppressive burst!');
for(let i=0;i<5;i++){const jitter=target.clone().add(new THREE.Vector3((Math.random()-.5)*.35,(Math.random()-.5)*.3,(Math.random()-.5)*.35));const muzzle=flash(origin,0xffd35b,.12);const tracer=streak(origin,jitter,0xffd18a,.012);await wait(85);muzzle.visible=false;tracer.visible=false}
await blast(target,.45);
}else if(type==='q'){
status('Sniper: target acquired!');
await wait(300);flash(origin,0xffd4a0,.13);const tracer=streak(origin,target,0xfff1c7,.009);await wait(125);tracer.visible=false;await blast(target,.24);
}else{
status(type==='k'?'General: sidearm fired!':'Private: pistol fired!');
flash(origin,0xffcc76,.17);const bullet=spawn(new THREE.SphereGeometry(.045,8,6),new THREE.MeshBasicMaterial({color:0xffc987}));await tween(180,k=>{bullet.position.lerpVectors(origin,target,k)});bullet.visible=false;await blast(target,.3);
}
}catch(error){console.error('Capture effect failed for '+(TYPES[type]||type),error);status('Attack effect failed; completing capture')}finally{cleanup()}
}
async function walk(actor,target,type){const start=actor.position.clone(),end=new THREE.Vector3(target.x,.12,target.z);setState(actor,'moving');await tween(type==='n'?650:950,k=>{actor.position.lerpVectors(start,end,k);if(type==='n')actor.position.y+=Math.sin(k*Math.PI)*1.9});setState(actor,'idle')}
async function performMove(from,to){busy=true;clearHighlights();const attacker=actors.get(from),type=attacker.userData.type;const move=game.move({from,to,promotion:'q'});if(!move){busy=false;return}const enPassant=move.flags.includes('e');const capturedSquare=enPassant?to[0]+from[1]:to;const victim=actors.get(capturedSquare);selected=null;legal=[];status(victim?`${TYPES[type]} attacks ${TYPES[victim.userData.type]}!`:`${TYPES[type]} advances to ${to}`);const dest=squareToWorld(to);if(victim){setState(victim,'targeted');if(el('cinematic').checked)await cameraFocus(attacker,victim);setState(attacker,'attacking');await wait(type==='r'?950:650);await effect(attacker,victim,type,from,capturedSquare);victim.userData.deathStyle=deathStyleFor(type);setState(victim,'dying');await wait(type==='n'?1450:type==='r'?1550:650);setState(attacker,'idle');await walk(attacker,dest,type);setState(victim,'idle');await tween(650,k=>{victim.position.y=.12-k*1.7;victim.scale.setScalar(1-.25*k)});boardGroup.remove(victim);actors.delete(capturedSquare)}else await walk(attacker,dest,type);actors.delete(from);actors.set(to,attacker);if(move.flags.includes('k')||move.flags.includes('q')||move.flags.includes('e')||move.flags.includes('p'))syncBoard();if(victim&&el('cinematic').checked)resetCamera();updateTurn();status(game.isGameOver()?'Game over':`${game.turn()==='w'?'White':'Black'} to move`);busy=false}
function resetCamera(){const from=camera.position.clone(),fromTarget=controls.target.clone(),to=mode==='battle'?new THREE.Vector3(10,15,16):new THREE.Vector3(0,4.5,14.5),target=mode==='battle'?new THREE.Vector3(0,0,0):new THREE.Vector3(0,.45,0);tween(600,k=>{camera.position.lerpVectors(from,to,k);controls.target.lerpVectors(fromTarget,target,k);controls.update()})}
// v0.4.11 fixes Rook battle-capture napalm positions and recovers cleanly from effect errors.
// v0.4.10 previews custom Rook and Knight deaths on the realistic soldier rig.
// v0.4.9 aligns the preview fire lane and backward grenade flip.
// v0.4.8 adds lane napalm and grenade-flip capture deaths.
// v0.4.7 grounds the retargeted Death pose from its rendered skinned bounds.
let realisticTemplate=null,realisticClip=null,realisticMixer=null,realisticActor=null,realisticWrapper=null,realisticLoading=false,realisticDeathPreview=null;
let referenceTemplate=null,referenceMixer=null,referenceActor=null,referenceWrapper=null,referenceLoading=false;
const realisticLoader=new GLTFLoader();
// Keep animation tracks from overriding the global miniature scale.
const RIG_PREVIEW_HEIGHT=1.1;
function removeRealistic(){for(const mixer of [realisticMixer,referenceMixer,sourceMixer])mixer?.stopAllAction();realisticMixer=referenceMixer=sourceMixer=null;for(const o of diagnosticObjects){previewGroup.remove(o);o.traverse(x=>{if(x.isSprite){x.material.map?.dispose();x.material.dispose()}if(x.isAxesHelper){x.geometry.dispose();x.material.dispose()}if(x.isLine){x.geometry.dispose();if(Array.isArray(x.material))x.material.forEach(m=>m.dispose());else x.material.dispose()}})}diagnosticObjects=[];sourceActor=referenceActor=null;sourceWrapper=referenceWrapper=realisticWrapper=null;diagnosticMixers=[];if(rigHelper){previewGroup.remove(rigHelper);rigHelper.geometry.dispose();rigHelper.material.dispose();rigHelper=null}realisticActor=null;groundDeathPose=false;realisticDeathPreview=null;for(const a of previewActors)if(a?.userData.body){a.userData.body.visible=true;a.userData.badge.visible=el('icons').checked}}
// Retarget in corresponding parent-rest frames, preserving the destination bind pose.
const BONE_MAP={
 root:'_rootJoint',pelvis:'Hips_01',spine_01:'Spine_02',spine_02:'Spine1_03',spine_03:'Spine2_04',neck_01:'Neck_05',Head:'Head_06',
 clavicle_l:'LeftShoulder_00',upperarm_l:'LeftArm_035',lowerarm_l:'LeftForeArm_036',hand_l:'LeftHand_037',
 clavicle_r:'RightShoulder_010',upperarm_r:'RightArm_011',lowerarm_r:'RightForeArm_012',hand_r:'RightHand_013',
 thigh_l:'LeftUpLeg_064',calf_l:'LeftLeg_065',foot_l:'LeftFoot_066',ball_l:'LeftToeBase_067',ball_leaf_l:'LeftToeEnd_068',
 thigh_r:'RightUpLeg_059',calf_r:'RightLeg_060',foot_r:'RightFoot_061',ball_r:'RightToeBase_062',ball_leaf_r:'RightToeEnd_063'
};
let animationSource=null,retargetCache=new Map(),animationLoading=false,rigHelper=null,sourceActor=null,sourceWrapper=null,sourceMixer=null,diagnosticObjects=[],diagnosticMixers=[],poseRefresh=0,groundDeathPose=false;
for(const side of ['l','r'])for(const [finger,dest] of Object.entries({index:'Index',middle:'Middle',ring:'Ring',pinky:'Pinky',thumb:'Thumb'}))for(let i=1;i<=4;i++){
 const key=finger+'_0'+i+(i===4?'_leaf':'')+'_'+side,base=side==='l'?{thumb:39,middle:43,ring:47,pinky:51,index:55}[finger]:{thumb:15,middle:19,ring:23,pinky:27,index:31}[finger],number=base+i-1;
 BONE_MAP[key]=(side==='l'?'LeftHand':'RightHand')+dest+i+'_'+String(number).padStart(3,'0');
}
function trackNodeName(name){const cut=name.lastIndexOf('.');return (cut<0?name:name.slice(0,cut)).split('/').pop().replace(/^\.bones\[/,'').replace(/\]$/,'')}
function relativeWorldQuaternion(root,node){root.updateMatrixWorld(true);node.updateMatrixWorld(true);const rq=new THREE.Quaternion(),nq=new THREE.Quaternion();root.getWorldQuaternion(rq);node.getWorldQuaternion(nq);return rq.invert().multiply(nq).normalize()}
function retargetClip(clip,target,sourceScale,targetScale){
 const source=animationSource.scene;source.updateMatrixWorld(true);target.updateMatrixWorld(true);const tracks=[],ratio=sourceScale/targetScale;
 for(const track of clip.tracks){const sourceName=trackNodeName(track.name),targetName=BONE_MAP[sourceName];if(!targetName)continue;const src=source.getObjectByName(sourceName),dst=target.getObjectByName(targetName);if(!src||!dst)continue;
  const axes=relativeWorldQuaternion(target,dst.parent).invert().multiply(relativeWorldQuaternion(source,src.parent)).normalize(),inverseAxes=axes.clone().invert();
  if(track.name.endsWith('.quaternion')){const sourceRestInverse=src.quaternion.clone().invert(),targetRest=dst.quaternion.clone(),values=[];for(let i=0;i<track.values.length;i+=4){const sampled=new THREE.Quaternion().fromArray(track.values,i),sourceDelta=sampled.multiply(sourceRestInverse),targetDelta=axes.clone().multiply(sourceDelta).multiply(inverseAxes),out=targetDelta.multiply(targetRest).normalize();values.push(out.x,out.y,out.z,out.w)}tracks.push(new THREE.QuaternionKeyframeTrack(targetName+'.quaternion',track.times,values))}
  else if(track.name.endsWith('.position')){const values=[];for(let i=0;i<track.values.length;i+=3){const p=new THREE.Vector3().fromArray(track.values,i).sub(src.position).applyQuaternion(axes).multiplyScalar(ratio).add(dst.position);values.push(p.x,p.y,p.z)}tracks.push(new THREE.VectorKeyframeTrack(targetName+'.position',track.times,values))}
  else if(track.name.endsWith('.scale')){const values=[];for(let i=0;i<track.values.length;i+=3){const s=new THREE.Vector3().fromArray(track.values,i),rest=src.scale.clone();for(const k of ['x','y','z'])s[k]=dst.scale[k]*(Math.abs(rest[k])>1e-8?s[k]/rest[k]:1);values.push(s.x,s.y,s.z)}tracks.push(new THREE.VectorKeyframeTrack(targetName+'.scale',track.times,values))}
 }
 return new THREE.AnimationClip('Retargeted_'+clip.name,clip.duration,tracks)
}
function loadAnimationLibrary(){
 if(animationSource||animationLoading)return;
 animationLoading=true;
 realisticLoader.load('./assets/animations/UAL1_Standard.glb',g=>{
  animationLoading=false;animationSource=g;retargetCache.clear();
  if(mode==='preview'&&el('realisticPreview').checked)attachRealistic();
 },undefined,e=>{animationLoading=false;console.warn('Animation library failed to load',e);status('Animation library could not load; celebration remains available')});
}
function boneList(root){const bones=[];root?.traverse(o=>{if(o.isBone)bones.push(o)});return bones}
function updateRigDiagnostics(visual,reference){
 const sourceBones=boneList(animationSource.scene),refBones=boneList(reference),targetBones=boneList(visual),mappings=Object.entries(BONE_MAP).map(([source,target])=>({source,target,sourceFound:!!animationSource.scene.getObjectByName(source),targetFound:!!visual.getObjectByName(target)}));
 for(const row of mappings){const s=animationSource.scene.getObjectByName(row.source),d=visual.getObjectByName(row.target);row.sourceParent=s?.parent?.name;row.targetParent=d?.parent?.name;row.parentMatch=BONE_MAP[row.sourceParent]===row.targetParent}
 const matched=mappings.filter(m=>m.sourceFound&&m.targetFound).length,split=mappings.filter(m=>m.sourceFound&&m.targetFound&&!m.parentMatch);let total=0,max=0,maxName='';
 let refTotal=0,refMax=0,refMaxName='';for(const m of mappings){const s=animationSource.scene.getObjectByName(m.source),r=reference.getObjectByName(m.source),d=visual.getObjectByName(m.target);if(!s||!r||!d)continue;const angle=THREE.MathUtils.radToDeg(s.quaternion.angleTo(d.quaternion)),refAngle=THREE.MathUtils.radToDeg(s.quaternion.angleTo(r.quaternion));total+=angle;refTotal+=refAngle;if(angle>max){max=angle;maxName=m.source}if(refAngle>refMax){refMax=refAngle;refMaxName=m.source}}
 const report='UAL/reference '+sourceBones.length+'/'+refBones.length+' joints • soldier mapped '+matched+'/'+mappings.length+' • parent-path differences '+split.length+' • rest delta source-to-soldier avg '+(total/Math.max(1,matched)).toFixed(1)+'°, max '+max.toFixed(1)+'° ('+maxName+'); source-to-reference avg '+(refTotal/Math.max(1,matched)).toFixed(1)+'°, max '+refMax.toFixed(1)+'° ('+refMaxName+')';el('rigDiagnostics').textContent=report;
 console.group('Battlefield Chess rig diagnostics');console.log(report);console.table(mappings);console.table(targetBones.map(b=>({name:b.name,parent:b.parent?.name,rotation:b.quaternion.toArray().map(n=>+n.toFixed(3))})));console.groupEnd();
}
function diagnosticLabel(name){
 const c=document.createElement('canvas');c.width=384;c.height=64;
 const ctx=c.getContext('2d');ctx.clearRect(0,0,384,64);
 ctx.font='bold 27px sans-serif';ctx.lineWidth=5;ctx.strokeStyle='#0b1625';
 ctx.strokeText(name,6,39);ctx.fillStyle='#fff0a5';ctx.fillText(name,6,39);
 const tex=new THREE.CanvasTexture(c),mat=new THREE.SpriteMaterial({map:tex,depthTest:false,transparent:true});
 const sprite=new THREE.Sprite(mat);sprite.scale.set(.53,.09,1);return sprite;
}
function addBoneGuides(root){
 const guide=new THREE.Group();previewGroup.add(guide);diagnosticObjects.push(guide);
 const major=['root','pelvis','spine_01','spine_02','spine_03','neck_01','Head','clavicle_l','upperarm_l','lowerarm_l','hand_l','clavicle_r','upperarm_r','lowerarm_r','hand_r','thigh_l','calf_l','foot_l','thigh_r','calf_r','foot_r','_rootJoint','Hips_01','Spine_02','Spine1_03','Spine2_04','Neck_05','Head_06','LeftShoulder_00','LeftArm_035','LeftForeArm_036','LeftHand_037','RightShoulder_010','RightArm_011','RightForeArm_012','RightHand_013','LeftUpLeg_064','LeftLeg_065','LeftFoot_066','RightUpLeg_059','RightLeg_060','RightFoot_061'];
 const entries=[];
 for(const name of major){
  const bone=root.getObjectByName(name);if(!bone||!bone.isBone)continue;
  const label=diagnosticLabel(name),axes=new THREE.AxesHelper(.13);
  guide.add(label,axes);entries.push({bone,label,axes});
 }
 diagnosticMixers.push(()=>{for(const {bone,label,axes} of entries){
  bone.updateWorldMatrix(true,false);
  const p=new THREE.Vector3(),q=new THREE.Quaternion();bone.getWorldPosition(p);bone.getWorldQuaternion(q);
  label.position.copy(p).add(new THREE.Vector3(0,.075,0));label.scale.set(.38,.064,1);axes.position.copy(p);axes.quaternion.copy(q);
  label.visible=el('showBoneLabels').checked;axes.visible=el('showBoneAxes').checked;
 }});
}
function normalizeRig(root,x,userScale){const b=new THREE.Box3().setFromObject(root,true),size=new THREE.Vector3(),center=new THREE.Vector3();b.getSize(size);b.getCenter(center);const targetHeight=RIG_PREVIEW_HEIGHT*userScale,wrapper=new THREE.Group();let scale=size.y>.001?targetHeight/size.y:1;wrapper.position.set(x-center.x*scale,.12-b.min.y*scale,-center.z*scale);wrapper.scale.setScalar(scale);wrapper.add(root);const skinned=[];root.traverse(o=>{if(o.isSkinnedMesh&&o.skeleton)skinned.push(o)});const rebind=()=>{wrapper.updateMatrixWorld(true);for(const skeleton of new Set(skinned.map(o=>o.skeleton)))skeleton.calculateInverses();for(const mesh of skinned)mesh.bind(mesh.skeleton,mesh.matrixWorld);wrapper.updateMatrixWorld(true)};rebind();for(let i=0;i<3;i++){const actual=new THREE.Box3().setFromObject(root,true),actualSize=actual.getSize(new THREE.Vector3());if(!Number.isFinite(actualSize.y)||actualSize.y<.001)break;const correction=targetHeight/actualSize.y;if(Math.abs(correction-1)<.005)break;wrapper.scale.multiplyScalar(correction);scale*=correction;rebind()}return {scale,wrapper}}
function setRigMeshVisibility(root,visible){root?.traverse(o=>{if(o.isMesh)o.visible=visible})}
function addRigHelper(root,id){const helper=new THREE.SkeletonHelper(root);helper.material.depthTest=false;helper.material.transparent=true;helper.material.opacity=.88;helper.visible=el(id).checked;previewGroup.add(helper);diagnosticObjects.push(helper);return helper}
function playSynced(mixer,clip,name){if(!mixer||!clip)return;const action=mixer.clipAction(clip);if(name==='Death01'){action.setLoop(THREE.LoopOnce,1);action.clampWhenFinished=true}action.play()}
function setupSourceComparison(selected,userScale){
 if(!animationSource||!referenceTemplate)return;
 const source=cloneSkeleton(animationSource.scene),sourceRig=normalizeRig(source,-1.5,userScale),sourceScale=sourceRig.scale;sourceWrapper=sourceRig.wrapper;setRigMeshVisibility(source,el('showSourceMesh').checked);previewGroup.add(sourceWrapper);diagnosticObjects.push(sourceWrapper);sourceActor=source;addRigHelper(source,'showSourceSkeleton');sourceMixer=new THREE.AnimationMixer(source);
 const reference=cloneSkeleton(referenceTemplate),referenceRig=normalizeRig(reference,0,userScale);referenceWrapper=referenceRig.wrapper;setRigMeshVisibility(reference,el('showReferenceMesh').checked);previewGroup.add(referenceWrapper);diagnosticObjects.push(referenceWrapper);referenceActor=reference;addRigHelper(reference,'showReferenceSkeleton');referenceMixer=new THREE.AnimationMixer(reference);
 const clip=animationSource.animations.find(a=>a.name===selected);if(clip){playSynced(sourceMixer,clip,selected);playSynced(referenceMixer,clip,selected)}
 addBoneGuides(source);addBoneGuides(reference);return sourceScale;
}
function updatePoseDiagnostics(){if(!animationSource||!sourceActor||!referenceActor||!realisticActor)return;const lines=[];for(const [src,dst] of [['pelvis','Hips_01'],['spine_02','Spine1_03'],['spine_03','Spine2_04'],['neck_01','Neck_05'],['Head','Head_06'],['upperarm_l','LeftArm_035'],['thigh_l','LeftUpLeg_064']]){const s=sourceActor.getObjectByName(src),a=referenceActor.getObjectByName(src),b=realisticActor.getObjectByName(dst);if(!s||!a||!b)continue;const deg=o=>o.rotation.toArray().slice(0,3).map(v=>THREE.MathUtils.radToDeg(v).toFixed(0)).join('/');lines.push(src+' XYZ° source '+deg(s)+' / ref '+deg(a)+' / soldier '+deg(b))}el('rigPoseDiagnostics').textContent=lines.join(' | ')}
function updateDiagnosticFrame(dt){
 if(!el('pauseRig').checked){for(const mixer of [sourceMixer,referenceMixer,realisticMixer])mixer?.update(dt)}
 else {const time=Number(el('rigFrame').value)/100;for(const mixer of [sourceMixer,referenceMixer,realisticMixer])if(mixer){mixer.setTime(time);mixer.update(0)}}
 groundRetargetedDeath();updateRealisticDeathPreview();
 for(const update of diagnosticMixers)update();
 poseRefresh+=dt;if(poseRefresh>.2){poseRefresh=0;updatePoseDiagnostics()}
}
function startRealisticDeathPreview(style,duration=1.5){if(!realisticWrapper)return;realisticMixer?.stopAllAction();realisticMixer=null;realisticDeathPreview={style,duration,start:performance.now(),position:realisticWrapper.position.clone(),rotation:realisticWrapper.rotation.clone()}}
function updateRealisticDeathPreview(){if(!realisticDeathPreview||!realisticWrapper)return;const d=realisticDeathPreview,elapsed=el('pauseRig').checked?Number(el('rigFrame').value)/100*1000:performance.now()-d.start,p=THREE.MathUtils.clamp(elapsed/(d.duration*1000),0,1),e=p*p*(3-2*p);realisticWrapper.position.copy(d.position);realisticWrapper.rotation.copy(d.rotation);if(d.style==='grenade-flip'){realisticWrapper.position.y=d.position.y+Math.sin(p*Math.PI)*1.15;realisticWrapper.rotation.x=d.rotation.x-e*2.35}else if(d.style==='napalm'){realisticWrapper.rotation.z=d.rotation.z-e*1.35;realisticWrapper.position.y=d.position.y-e*.04}}
function groundRetargetedDeath(){
 if(!groundDeathPose||!realisticActor||!realisticWrapper)return;
 realisticActor.updateWorldMatrix(true,true);
 const bounds=new THREE.Box3().setFromObject(realisticActor,true);
 if(bounds.isEmpty()||!Number.isFinite(bounds.min.y))return;
 const correction=.12-bounds.min.y;
 if(Math.abs(correction)>.0001){realisticWrapper.position.y+=correction;realisticWrapper.updateWorldMatrix(true,true)}
}
function attachRealistic(){
 removeRealistic();
 if(mode!=='preview'||!el('realisticPreview').checked||!realisticTemplate||!referenceTemplate||!animationSource)return;
 const proxy=previewActors[0];if(!proxy)return;const userScale=Number(el('soldierScale').value),visual=cloneSkeleton(realisticTemplate),soldierRig=normalizeRig(visual,1.5,userScale),scale=soldierRig.scale;realisticWrapper=soldierRig.wrapper;
 visual.traverse(o=>{if(o.isLight)o.visible=false;if(o.isMesh){o.castShadow=true;o.frustumCulled=false}});
 realisticActor=visual;previewGroup.add(realisticWrapper);diagnosticObjects.push(realisticWrapper);setRigMeshVisibility(visual,el('showSoldierMesh').checked);if(el('showSkeleton').checked)rigHelper=addRigHelper(visual,'showSkeleton');
 for(const piece of previewActors)if(piece?.userData.body){piece.userData.body.visible=false;piece.userData.badge.visible=false}
 const selectedAnimation=el('realisticAnimation').value;
 groundDeathPose=selectedAnimation==='Death01';
 let clip=null;
 if(selectedAnimation==='celebration')clip=realisticClip;
 else if(animationSource){
  const original=animationSource.animations.find(a=>a.name===selectedAnimation);
  if(original)clip=retargetClip(original,visual,RIG_PREVIEW_HEIGHT/Math.max(.001,new THREE.Box3().setFromObject(animationSource.scene).getSize(new THREE.Vector3()).y)*userScale,scale);
 }
 if(clip?.tracks.length){realisticMixer=new THREE.AnimationMixer(visual);playSynced(realisticMixer,clip,selectedAnimation)}
 setupSourceComparison(selectedAnimation,userScale);updateRigDiagnostics(visual,referenceActor);addBoneGuides(visual);updatePoseDiagnostics();if(el('blackAnim').value==='dying')startRealisticDeathPreview(deathStyleFor(el('whitePiece').value),1.5);
 status(selectedAnimation==='celebration'?'Soldier • Celebration Dance (embedded animation)':clip?'Synchronized Quaternius • '+selectedAnimation:'Rest-pose comparison');
}
function loadRealistic(){
 if(!realisticTemplate&&!realisticLoading){realisticLoading=true;status('Loading soldier rig…');realisticLoader.load('./assets/soldier/scene.gltf',g=>{realisticLoading=false;realisticTemplate=g.scene;realisticClip=g.animations[0]||null;attachRealistic()},undefined,e=>{realisticLoading=false;status('Soldier model failed to load; check assets/soldier/');console.warn('Soldier asset missing',e)})}
 if(!referenceTemplate&&!referenceLoading){referenceLoading=true;realisticLoader.load('./assets/reference/scene.gltf',g=>{referenceLoading=false;referenceTemplate=g.scene;attachRealistic()},undefined,e=>{referenceLoading=false;status('Quaternius reference failed to load; check assets/reference/');console.warn('Reference rig asset missing',e)})}
 loadAnimationLibrary();if(realisticTemplate&&referenceTemplate&&animationSource)attachRealistic();
}
function refreshRigVisibility(){setRigMeshVisibility(sourceActor,el('showSourceMesh').checked);setRigMeshVisibility(referenceActor,el('showReferenceMesh').checked);setRigMeshVisibility(realisticActor,el('showSoldierMesh').checked);if(rigHelper)rigHelper.visible=el('showSkeleton').checked;for(const o of diagnosticObjects)if(o.isSkeletonHelper){if(o.root===sourceActor)o.visible=el('showSourceSkeleton').checked;else if(o.root===referenceActor)o.visible=el('showReferenceSkeleton').checked}}
for(const id of ['showSourceMesh','showSourceSkeleton','showReferenceMesh','showReferenceSkeleton','showSoldierMesh','showSkeleton'])el(id).addEventListener('change',refreshRigVisibility);
for(const id of ['showBoneLabels','showBoneAxes'])el(id).addEventListener('change',()=>{for(const update of diagnosticMixers)update()});
el('realisticAnimation').addEventListener('change',()=>{if(realisticTemplate&&el('realisticPreview').checked)attachRealistic()});
el('soldierScale').addEventListener('input',()=>{const factor=Number(el('soldierScale').value);el('soldierScaleValue').textContent=Math.round(factor*100)+'% / '+(RIG_PREVIEW_HEIGHT*factor).toFixed(2)+'m';if(realisticTemplate&&el('realisticPreview').checked)attachRealistic()});
el('realisticPreview').addEventListener('change',()=>{if(el('realisticPreview').checked)loadRealistic();else{removeRealistic();previewBuild()}});
el('pauseRig').addEventListener('change',()=>{if(el('pauseRig').checked)el('rigFrame').value=Math.round((realisticMixer?.time||0)*100)});
el('rigFrame').addEventListener('input',()=>{el('pauseRig').checked=true;const t=Number(el('rigFrame').value)/100;for(const mixer of [sourceMixer,referenceMixer,realisticMixer])if(mixer){mixer.setTime(t);mixer.update(0)}updatePoseDiagnostics()});
function previewBuild(){removeRealistic();previewActors.forEach(a=>{if(a)previewGroup.remove(a)});previewActors=[];[['whitePiece','whiteAnim','w',-1.5],['blackPiece','blackAnim','b',1.5]].forEach(([id,aid,color,x])=>{if(el(id).value==='none'){previewActors.push(null);return}const a=soldier(el(id).value,color);a.position.set(x,.12,0);a.rotation.y=color==='w'?Math.PI/2:-Math.PI/2;setState(a,el(aid).value);if(id==='blackPiece'&&el(aid).value==='dying')a.userData.deathStyle=deathStyleFor(el('whitePiece').value);previewGroup.add(a);previewActors.push(a)});if(el('realisticPreview').checked&&realisticTemplate)attachRealistic()}
function setMode(next){mode=next;boardGroup.visible=next==='battle';previewGroup.visible=next==='preview';el('battleControls').classList.toggle('hide',next!=='battle');el('previewControls').classList.toggle('hide',next!=='preview');el('battleBtn').classList.toggle('primary',next==='battle');el('previewBtn').classList.toggle('primary',next==='preview');if(next==='preview'){previewBuild();status('Animation preview studio');if(el('realisticPreview').checked)loadRealistic()}else{removeRealistic();status('Select a piece to move')};resetCamera()}
for(const [id,initial] of [['whitePiece','p'],['blackPiece','q']]){if(id==='blackPiece'){const none=document.createElement('option');none.value='none';none.textContent='None (hide black piece)';el(id).append(none)}for(const [key,name] of Object.entries(TYPES)){const o=document.createElement('option');o.value=key;o.textContent=`${SYMBOL[id==='whitePiece'?'w':'b'][key]} ${name}`;el(id).append(o)}el(id).value=initial;el(id).addEventListener('change',previewBuild)}for(const id of ['whiteAnim','blackAnim']){for(const name of ANIMS){const o=document.createElement('option');o.value=name;o.textContent=name[0].toUpperCase()+name.slice(1);el(id).append(o)}el(id).value=id==='blackAnim'?'targeted':'idle';el(id).addEventListener('change',previewBuild)}
el('battleBtn').onclick=()=>setMode('battle');el('previewBtn').onclick=()=>setMode('preview');el('cameraBtn').onclick=resetCamera;el('previewCamera').onclick=resetCamera;el('resetBtn').onclick=()=>{if(busy)return;game.reset();syncBoard();clearHighlights();selected=null;setMode('battle');status('New game ready')};el('undoBtn').onclick=()=>{if(busy)return;game.undo();syncBoard();clearHighlights();selected=null;status('Last move undone')};el('icons').onchange=()=>{for(const a of [...actors.values(),...previewActors])if(a)a.userData.badge.visible=el('icons').checked};el('testAttack').onclick=async()=>{if(busy)return;busy=true;const panel=document.getElementById('ui');if(!panel.classList.contains('collapsed'))document.getElementById('uiToggle').click();await wait(250);const [a,b]=previewActors;if(!a||!b){status('Select a black piece to test an attack');busy=false;return}setState(a,'highlighted');setState(b,'targeted');status('Preview: acquiring target');await cameraFocus(a,b);setState(a,'attacking');await wait(850);await effect(a,b,a.userData.type);b.userData.deathStyle=deathStyleFor(a.userData.type);startRealisticDeathPreview(b.userData.deathStyle,a.userData.type==='n'?1.45:1.55);setState(b,'dying');await wait(a.userData.type==='n'?1450:a.userData.type==='r'?1550:1250);previewBuild();resetCamera();status('Preview attack complete');busy=false};
const clock=new THREE.Clock();
function animate(){
requestAnimationFrame(animate);
const dt=Math.min(clock.getDelta(),.05),t=performance.now()/1000;updateDiagnosticFrame(dt);
for(const a of [...actors.values(),...previewActors]){
if(!a)continue;
const u=a.userData;u.age+=dt;
const w=u.age,cycle=t*2.5+a.id;
a.rotation.x=0;
u.body.position.set(0,0,0);u.body.rotation.set(0,0,0);
for(const arm of u.arms)arm.rotation.set(0,0,0);
for(const leg of u.legs)leg.rotation.set(0,0,0);
if(u.state==='idle'){
u.body.position.y=Math.sin(cycle)*.018;
u.arms[0].rotation.x=.14;u.arms[1].rotation.x=-.14;
u.body.rotation.y=Math.sin(t*.6+a.id)*.08;
}else if(u.state==='highlighted'){
u.body.position.y=.065+Math.sin(t*5)*.035;
u.body.rotation.y=Math.sin(t*1.7)*.25;
u.arms[0].rotation.x=-1.25;u.arms[1].rotation.x=-.85;
u.arms[0].rotation.z=-.35;
}else if(u.state==='targeted'){
u.body.position.y=-.14;
u.body.rotation.x=.26;
u.body.rotation.z=Math.sin(t*8)*.06;
u.arms[0].rotation.x=-1.65;u.arms[1].rotation.x=-1.35;
u.legs[0].rotation.x=-.65;u.legs[1].rotation.x=.5;
}else if(u.state==='moving'){
const stride=Math.sin(t*11);
u.body.position.y=.08+Math.abs(stride)*.08;
u.body.rotation.x=-.17;
u.legs[0].rotation.x=stride*.8;u.legs[1].rotation.x=-stride*.8;
u.arms[0].rotation.x=-stride*.65;u.arms[1].rotation.x=stride*.65;
}else if(u.state==='attacking'){
const pulse=Math.sin(t*15);
u.body.rotation.x=-.12;u.body.rotation.z=pulse*.055;
u.arms[0].rotation.x=-1.15;u.arms[1].rotation.x=-1.5+pulse*.13;
u.arms[0].rotation.z=-.22;u.arms[1].rotation.z=.15;
u.legs[0].rotation.x=-.25;u.legs[1].rotation.x=.3;
}else if(u.state==='dying'){
const style=u.deathStyle||'fall';const progress=Math.min(w/(style==='grenade-flip'?1.35:style==='napalm'?1.55:1.4),1);
if(style==='grenade-flip'){a.position.y=.12+Math.sin(progress*Math.PI)*1.35;a.rotation.x=-progress*1.45;u.body.rotation.z=Math.sin(progress*Math.PI)*.12;u.arms[0].rotation.z=-.7;u.arms[1].rotation.z=.7;u.legs[0].rotation.x=-.55;u.legs[1].rotation.x=.55;}else if(style==='napalm'){u.body.rotation.z=-progress*1.48;u.body.rotation.x=progress*.28;u.body.position.y=-progress*.52;u.arms[0].rotation.x=-progress*1.8;u.arms[1].rotation.x=progress*.85;u.legs[0].rotation.x=progress*.65;u.legs[1].rotation.x=-progress*.4;}else{u.body.rotation.z=-progress*1.48;u.body.rotation.x=progress*.28;u.body.position.y=-progress*.52;u.arms[0].rotation.x=-progress*1.8;u.arms[1].rotation.x=progress*.85;u.legs[0].rotation.x=progress*.65;u.legs[1].rotation.x=-progress*.4;}
if(mode==='preview'&&w>2.8)setState(a,'dying');
}
u.badge.visible=el('icons').checked&&!(a===previewActors[0]&&realisticActor);
}
controls.update();renderer.render(scene,camera);
}
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});syncBoard();setMode('battle');animate();
