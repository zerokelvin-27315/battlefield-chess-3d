// Integration checks: published physics parity and copy/import → CLI authoring.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {defaultSettings,exportPreset,importPreset} from '../../ragdoll-simulation.js';

const repo=path.resolve(import.meta.dirname,'../..'),temp=await fs.mkdtemp(path.join(os.tmpdir(),'ragdoll-studio-check-'));
function bake(args){execFileSync(process.execPath,[path.join(import.meta.dirname,'bake-deaths.mjs'),...args],{cwd:repo,stdio:'pipe',timeout:180000})}
try{
 for(const type of ['chest','blast','collapse']){const preset=exportPreset(type,defaultSettings(type));assert.deepEqual(importPreset(JSON.stringify(preset)),preset)}
 for(const change of [p=>p.version=99,p=>p.engine='unknown',p=>p.settings.gravity=Infinity,p=>p.settings.impacts[0].target='unknown',p=>p.settings.impacts[0].at=8,p=>p.settings.impacts[0].impulse=[1,2],p=>p.settings.duration=0]){
  const preset=exportPreset('Invalid',defaultSettings());change(preset);assert.throws(()=>importPreset(preset));
 }
 console.log('PASS preset round trips and rejection of invalid/incompatible input');
 const standardPath=path.join(temp,'standard.json');bake(['--output',standardPath]);
 const standard=JSON.parse(await fs.readFile(standardPath)),published=JSON.parse(await fs.readFile(path.join(repo,'assets/animations/ragdoll-deaths.json')));
 assert.deepEqual(standard.clips,published.clips);assert.deepEqual(standard.diagnostics,published.diagnostics);
 console.log('PASS shared browser/CLI solver reproduces published chest and blast clips exactly');
 const settings=defaultSettings('collapse');settings.duration=1.2;settings.releaseWeapon=false;
 settings.impacts=[{at:0,duration:.06,target:'chest',impulse:[15,80,-40],offset:[.05,0,0]},{at:.3,duration:.06,target:'head',impulse:[-5,0,-8],offset:[0,.03,0]}];
 const preset=exportPreset('Two timed impacts',settings),presetPath=path.join(temp,'preset.json'),customPath=path.join(temp,'custom.json');await fs.writeFile(presetPath,JSON.stringify(preset));
 bake(['--preset',presetPath,'--output',customPath]);const custom=JSON.parse(await fs.readFile(customPath));
 assert.equal(custom.clips.length,1);assert.equal(custom.clips[0].name,'DeathCustom');assert.equal(custom.clips[0].duration,1.2);assert.deepEqual(custom.presets.DeathCustom,preset);
 assert(custom.diagnostics.DeathCustom.maxAnchorError<.01,'Custom ragdoll must preserve connected joints');
 for(const track of custom.clips[0].tracks)assert(track.values.every(Number.isFinite),'All custom bone tracks must remain finite');
 const weapon=custom.clips[0].tracks.filter(t=>t.name.startsWith('RiflemanWeapon.'));assert(weapon.every(t=>t.times.length===1),'Holding the rifle must preserve its local transform');
 assert.notDeepEqual(custom.diagnostics.DeathCustom['0.00'].pelvis,custom.diagnostics.DeathCustom['1.20'].pelvis);
 console.log('PASS copied preset bakes two timed off-center impacts, custom duration, and held rifle');
}finally{await fs.rm(temp,{recursive:true,force:true})}
