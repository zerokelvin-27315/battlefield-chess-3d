import * as THREE from 'https://esm.sh/three@0.169.0';
import {OrbitControls} from 'https://esm.sh/three@0.169.0/examples/jsm/controls/OrbitControls.js';
import {Chess} from 'https://esm.sh/chess.js@1.0.0';

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
function setState(actor,state){if(!actor)return;actor.userData.state=state;actor.userData.age=0;actor.userData.dying=state==='dying'}
function syncBoard(){for(const a of actors.values())boardGroup.remove(a);actors.clear();for(let r=0;r<8;r++)for(let f=0;f<8;f++){const sq=String.fromCharCode(97+f)+(r+1),piece=game.get(sq);if(!piece)continue;const a=soldier(piece.type,piece.color),p=squareToWorld(sq);a.position.set(p.x,.12,p.z);a.rotation.y=piece.color==='w'?Math.PI:0;boardGroup.add(a);actors.set(sq,a)}updateTurn()}
function updateTurn(){const turn=game.turn()==='w'?'White':'Black';el('turn').textContent=game.isCheckmate()?`Checkmate! ${turn==='White'?'Black':'White'} wins`:game.isDraw()?'Draw':`${turn} to move${game.isCheck()?' • CHECK':''}`}
function chooseSquare(sq){if(busy||mode!=='battle'||game.isGameOver())return;const piece=game.get(sq);if(selected&&legal.includes(sq)){performMove(selected,sq);return}clearHighlights();for(const a of actors.values())setState(a,'idle');if(piece&&piece.color===game.turn()){selected=sq;legal=game.moves({square:sq,verbose:true}).map(m=>m.to);mark(sq,0x4fb3dc);legal.forEach(s=>mark(s,game.get(s)?0xff684f:0x58cc98));setState(actors.get(sq),'highlighted');status(`${TYPES[piece.type]} selected • ${legal.length} legal moves`)}else{selected=null;legal=[];status('Select a friendly piece')}}
const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();let pointerStart=null;renderer.domElement.addEventListener('pointerdown',e=>pointerStart={x:e.clientX,y:e.clientY});renderer.domElement.addEventListener('pointerup',e=>{if(!pointerStart||Math.hypot(e.clientX-pointerStart.x,e.clientY-pointerStart.y)>7)return;pointerStart=null;if(mode!=='battle')return;mouse.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);raycaster.setFromCamera(mouse,camera);const hits=raycaster.intersectObjects(tileMeshes);if(hits.length)chooseSquare(hits[0].object.userData.square)});
function wait(ms){return new Promise(resolve=>setTimeout(resolve,ms))}function tween(duration,fn){return new Promise(resolve=>{const start=performance.now();function tick(t){const k=Math.min(1,(t-start)/duration);fn(k);if(k<1)requestAnimationFrame(tick);else resolve()}requestAnimationFrame(tick)})}
async function cameraFocus(attacker,defender){const center=attacker.position.clone().add(defender.position).multiplyScalar(.5);center.y=1;const separation=attacker.position.distanceTo(defender.position);const aspect=camera.aspect;const verticalFov=THREE.MathUtils.degToRad(camera.fov);const horizontalFov=2*Math.atan(Math.tan(verticalFov/2)*aspect);const limitingFov=Math.min(verticalFov,horizontalFov);const radius=Math.max(2.7,separation*.65+1.1);const distance=Math.max(10,(radius/Math.sin(limitingFov/2))*1.2);const side=new THREE.Vector3(1,.65,1).normalize();const to=center.clone().addScaledVector(side,distance);const from=camera.position.clone(),targetFrom=controls.target.clone();await tween(700,k=>{const t=k*k*(3-2*k);camera.position.lerpVectors(from,to,t);controls.target.lerpVectors(targetFrom,center,t);controls.update()})}
function effect(from,to,type){const origin=from.position.clone().add(new THREE.Vector3(0,1.15,0)),end=to.position.clone().add(new THREE.Vector3(0,1,0));const beam=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,1,6),new THREE.MeshBasicMaterial({color:type==='r'?0xff9345:0xffdb83,transparent:true,opacity:.95}));const dist=origin.distanceTo(end);beam.scale.y=dist;beam.position.copy(origin).add(end).multiplyScalar(.5);beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.clone().sub(origin).normalize());scene.add(beam);setTimeout(()=>{scene.remove(beam);beam.geometry.dispose();beam.material.dispose()},type==='b'?380:220);const flash=new THREE.PointLight(0xffb457,10,3);flash.position.copy(end);scene.add(flash);setTimeout(()=>scene.remove(flash),180)}
async function walk(actor,target,type){const start=actor.position.clone(),end=new THREE.Vector3(target.x,.12,target.z);setState(actor,'moving');await tween(type==='n'?650:950,k=>{actor.position.lerpVectors(start,end,k);if(type==='n')actor.position.y+=Math.sin(k*Math.PI)*1.9});setState(actor,'idle')}
async function performMove(from,to){busy=true;clearHighlights();const attacker=actors.get(from),victim=actors.get(to),type=attacker.userData.type;const move=game.move({from,to,promotion:'q'});if(!move){busy=false;return}selected=null;legal=[];status(victim?`${TYPES[type]} attacks ${TYPES[victim.userData.type]}!`:`${TYPES[type]} advances to ${to}`);const dest=squareToWorld(to);if(victim){setState(victim,'targeted');if(el('cinematic').checked)await cameraFocus(attacker,victim);setState(attacker,'attacking');await wait(type==='r'?950:650);effect(attacker,victim,type);await wait(250);setState(victim,'dying');await wait(650);setState(attacker,'idle');await walk(attacker,dest,type);await tween(650,k=>{victim.position.y=.12-k*1.7;victim.scale.setScalar(1-.25*k)});boardGroup.remove(victim)}else await walk(attacker,dest,type);actors.delete(from);actors.set(to,attacker);if(move.flags.includes('k')||move.flags.includes('q')||move.flags.includes('e')||move.flags.includes('p'))syncBoard();if(victim&&el('cinematic').checked)resetCamera();updateTurn();status(game.isGameOver()?'Game over':`${game.turn()==='w'?'White':'Black'} to move`);busy=false}
function resetCamera(){const from=camera.position.clone(),fromTarget=controls.target.clone(),to=mode==='battle'?new THREE.Vector3(10,15,16):new THREE.Vector3(6,5,8);tween(600,k=>{camera.position.lerpVectors(from,to,k);controls.target.lerpVectors(fromTarget,new THREE.Vector3(0,0,0),k);controls.update()})}
function previewBuild(){previewActors.forEach(a=>previewGroup.remove(a));previewActors=[];[['whitePiece','whiteAnim','w',-1.5],['blackPiece','blackAnim','b',1.5]].forEach(([id,aid,color,x])=>{const a=soldier(el(id).value,color);a.position.set(x,.12,0);a.rotation.y=color==='w'?Math.PI/2:-Math.PI/2;setState(a,el(aid).value);previewGroup.add(a);previewActors.push(a)})}
function setMode(next){mode=next;boardGroup.visible=next==='battle';previewGroup.visible=next==='preview';el('battleControls').classList.toggle('hide',next!=='battle');el('previewControls').classList.toggle('hide',next!=='preview');el('battleBtn').classList.toggle('primary',next==='battle');el('previewBtn').classList.toggle('primary',next==='preview');if(next==='preview'){previewBuild();status('Animation preview studio')}else status('Select a piece to move');resetCamera()}
for(const [id,initial] of [['whitePiece','p'],['blackPiece','q']]){for(const [key,name] of Object.entries(TYPES)){const o=document.createElement('option');o.value=key;o.textContent=`${SYMBOL[id==='whitePiece'?'w':'b'][key]} ${name}`;el(id).append(o)}el(id).value=initial;el(id).addEventListener('change',previewBuild)}for(const id of ['whiteAnim','blackAnim']){for(const name of ANIMS){const o=document.createElement('option');o.value=name;o.textContent=name[0].toUpperCase()+name.slice(1);el(id).append(o)}el(id).value=id==='blackAnim'?'targeted':'idle';el(id).addEventListener('change',previewBuild)}
el('battleBtn').onclick=()=>setMode('battle');el('previewBtn').onclick=()=>setMode('preview');el('cameraBtn').onclick=resetCamera;el('previewCamera').onclick=resetCamera;el('resetBtn').onclick=()=>{if(busy)return;game.reset();syncBoard();clearHighlights();selected=null;setMode('battle');status('New game ready')};el('undoBtn').onclick=()=>{if(busy)return;game.undo();syncBoard();clearHighlights();selected=null;status('Last move undone')};el('icons').onchange=()=>{for(const a of [...actors.values(),...previewActors])a.userData.badge.visible=el('icons').checked};el('testAttack').onclick=async()=>{if(busy)return;busy=true;const [a,b]=previewActors;setState(a,'highlighted');setState(b,'targeted');status('Preview: acquiring target');await cameraFocus(a,b);setState(a,'attacking');await wait(850);effect(a,b,a.userData.type);setState(b,'dying');await wait(1250);previewBuild();resetCamera();status('Preview attack complete');busy=false};
const clock=new THREE.Clock();
function animate(){
requestAnimationFrame(animate);
const dt=Math.min(clock.getDelta(),.05),t=performance.now()/1000;
for(const a of [...actors.values(),...previewActors]){
const u=a.userData;u.age+=dt;
const w=u.age,cycle=t*2.5+a.id;
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
const progress=Math.min(w/1.4,1);
u.body.rotation.z=-progress*1.48;
u.body.rotation.x=progress*.28;
u.body.position.y=-progress*.52;
u.arms[0].rotation.x=-progress*1.8;u.arms[1].rotation.x=progress*.85;
u.legs[0].rotation.x=progress*.65;u.legs[1].rotation.x=-progress*.4;
if(mode==='preview'&&w>2.8)setState(a,'dying');
}
u.badge.visible=el('icons').checked;
}
controls.update();renderer.render(scene,camera);
}
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});syncBoard();setMode('battle');animate();