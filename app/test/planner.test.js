import test from 'node:test';
import assert from 'node:assert/strict';
import {exposure,toggleActive} from '../public/planner.mjs';
test('threshold is inclusive and bench does not count',()=>{
 const roster=Array.from({length:10},(_,i)=>({id:String(i),types:['grass']}));
 const fire=exposure(roster,['0','1','2'],false,3).find(x=>x.type==='fire');
 assert.equal(fire.count,3);assert.equal(fire.flagged,true);
 assert.equal(exposure(roster,['0','1'],false,3).find(x=>x.type==='fire').flagged,false);
});
test('full-team swap preserves six and bench toggle frees a slot',()=>{
 const ids=['a','b','c','d','e','f'];
 assert.deepEqual(toggleActive(ids,'g'),ids);
 assert.deepEqual(toggleActive(ids,'c','g'),['a','b','g','d','e','f']);
 assert.equal(toggleActive(ids,'c').length,5);
 assert.deepEqual(ids,['a','b','c','d','e','f']);
});
test('inverse weaknesses use only active shortlist members',()=>{
 const roster=[{id:'a',types:['normal']},{id:'b',types:['ghost']}];
 assert.equal(exposure(roster,['a'],true,1).find(r=>r.type==='ghost').count,1);
 assert.equal(exposure(roster,['a'],false,1).find(r=>r.type==='ghost').count,0);
});
