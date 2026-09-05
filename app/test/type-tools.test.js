import test from 'node:test';
import assert from 'node:assert/strict';
import {cleanTypes,defenseProfile,offenseProfile,defenderCombinations} from '../public/type-tools.mjs';
const hit = (profile, ...types) => profile.find(p => p.types.join('/') === types.join('/'));
test('dual defense multiplies weaknesses, resistances, and immunities', () => {
  const gliscor = defenseProfile(['ground','flying']);
  assert.equal(hit(gliscor,'ice').value,4);
  assert.equal(hit(gliscor,'electric').value,0);
  assert.equal(hit(gliscor,'grass').value,1);
  assert.equal(hit(defenseProfile(['bug','steel']),'grass').value,0.25);
});
test('inverse flips individual charts before multiplication, including immunities', () => {
  const gliscor = defenseProfile(['ground','flying'],true);
  assert.equal(hit(gliscor,'electric').value,1);
  assert.equal(hit(gliscor,'ice').value,0.25);
  assert.equal(hit(defenseProfile(['normal','dark'],true),'ghost').value,4);
});
test('offensive choices use strongest one, not product or STAB', () => {
  const coverage = offenseProfile(['ice','ground'],false,true);
  assert.equal(hit(coverage,'ground','flying').value,4);
  assert.deepEqual(hit(coverage,'ground','flying').best,['ice']);
  assert.equal(hit(coverage,'water').value,1);
  assert.equal(hit(offenseProfile(['normal']), 'ghost').value,0);
  assert.equal(hit(offenseProfile(['normal'],true),'ghost').value,2);
});
test('all unique single and dual combinations, with no order duplicates', () => {
  const combinations = defenderCombinations(true);
  assert.equal(combinations.length,171);
  assert.equal(new Set(combinations.map(t => t.join('/'))).size,171);
  assert.equal(defenderCombinations().length,18);
  assert.ok(combinations.every(t => new Set(t).size === t.length));
});
test('empty or unknown selection has no misleading neutral result; duplicate types normalize', () => {
  assert.deepEqual(defenseProfile([]),[]);
  assert.deepEqual(offenseProfile(['unknown']),[]);
  assert.deepEqual(cleanTypes(['FIRE','fire','bogus','water']),['fire','water']);
  assert.equal(hit(defenseProfile(['fire','fire']),'water').value,2);
});
