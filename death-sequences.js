import * as THREE from 'https://esm.sh/three@0.169.0';

// Physics clips are baked offline; the browser only plays skeletal keyframes.
export const DEATH_SEQUENCES=[
 {name:'Death01',label:'Death · collapse'},
 {name:'DeathChest',label:'Death · chest shot'},
 {name:'DeathHead',label:'Death · headshot'},
 {name:'DeathBlast',label:'Death · blast knockdown'},
 {name:'DeathRepeated',label:'Death · repeated hits'}
];
const cache=new WeakMap();
const ragdolls=new WeakMap();
export function registerRagdollClips(library,data){
 if(data.format!==1||!Array.isArray(data.clips))throw new Error('Unsupported baked ragdoll data');
 const clips=new Map(data.clips.map(json=>{const clip=THREE.AnimationClip.parse(json);return [clip.name,clip]}));
 for(const name of ['DeathChest','DeathBlast'])if(!clips.has(name))throw new Error('Missing baked '+name);
 ragdolls.set(library,clips);
}
export function isDeathSequence(name){return DEATH_SEQUENCES.some(s=>s.name===name)}
export function getPreviewClip(library,name){
 if(ragdolls.get(library)?.has(name))return ragdolls.get(library).get(name);
 if(name==='DeathChest'||name==='DeathBlast')throw new Error('Baked ragdoll clips must be loaded before playback');
 if(!isDeathSequence(name)||name==='Death01')return library.find(c=>c.name===name);
 let clips=cache.get(library);if(!clips){clips=new Map();cache.set(library,clips)}if(clips.has(name))return clips.get(name);
 const death=library.find(c=>c.name==='Death01'),hit=library.find(c=>c.name===(name==='DeathHead'?'Hit_Head':'Hit_Chest'));
 if(!death||!hit)throw new Error('Death compositions require Death01, Hit_Chest and Hit_Head');
 const repeated=name==='DeathRepeated',lead=hit.duration*(repeated?3:1),blend=.20,duration=lead+blend+death.duration;
 const hitTracks=new Map(hit.tracks.map(t=>[t.name,t])),times=[];
 for(let frame=0;frame<Math.ceil(duration*30);frame++)times.push(frame/30);times.push(duration);
 const tracks=death.tracks.map(track=>{
  const values=[],size=track.getValueSize(),deathSampler=track.createInterpolant(),hitSampler=hitTracks.get(track.name)?.createInterpolant(),q1=new THREE.Quaternion(),q2=new THREE.Quaternion();
  for(const time of times){
   const deathTime=Math.min(death.duration,Math.max(0,time-lead-blend));
   // Interpolants reuse their output buffers: copy before the next evaluation.
   let pose=Array.from(deathSampler.evaluate(deathTime));
   if(hitSampler&&time<lead)pose=Array.from(hitSampler.evaluate(Math.min(hit.duration,time%hit.duration)));
   else if(hitSampler&&time<lead+blend){
    const start=Array.from(hitSampler.evaluate(hit.duration)),end=Array.from(deathSampler.evaluate(0)),t=THREE.MathUtils.smoothstep(time,lead,lead+blend);
    if(size===4){q1.fromArray(start);q2.fromArray(end);pose=q1.slerp(q2,t).toArray()}else pose=start.map((value,i)=>THREE.MathUtils.lerp(value,end[i],t));
   }
   values.push(...pose);
  }
  const Type=size===4?THREE.QuaternionKeyframeTrack:THREE.VectorKeyframeTrack;return new Type(track.name,times,values,THREE.InterpolateLinear);
 });
 const clip=new THREE.AnimationClip(name,duration,tracks);clips.set(name,clip);return clip;
}

export function playPreviewClip(mixer,clip){
 const action=mixer.clipAction(clip),death=isDeathSequence(clip.name);action.setLoop(death?THREE.LoopOnce:THREE.LoopRepeat,death?1:Infinity);action.clampWhenFinished=death;action.play();return action;
}

// A clamped LoopOnce action pauses itself on completion. Reactivate it before
// seeking so scrubbing backwards after a finished death evaluates the new pose.
export function seekPreviewClip(mixer,action,time){action.paused=false;action.enabled=true;mixer.setTime(Math.max(0,time));mixer.update(0);}
