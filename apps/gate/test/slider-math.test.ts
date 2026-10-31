import assert from 'node:assert/strict';
import test from 'node:test';

import { THRESHOLD_RANGE } from '../src/lib/gate-presentation.ts';
import { fractionForValue, snapValue, valueAtPosition } from '../src/lib/slider-math.ts';

const range = { max: 128, min: 0, step: 1 };

test('values clamp to the range and snap to the step', () => {
  assert.equal(snapValue(-5, range), 0);
  assert.equal(snapValue(200, range), 128);
  assert.equal(snapValue(80.4, range), 80);
  assert.equal(snapValue(80.6, range), 81);
  assert.equal(snapValue(Number.NaN, range), 0);
  assert.equal(snapValue(7, { max: 20, min: 0, step: 5 }), 5);
  assert.equal(snapValue(0.3, { max: 1, min: 0, step: 0.1 }), 0.3);
});

test('touch position maps to a value across the whole rail', () => {
  assert.equal(valueAtPosition(0, 256, range), 0);
  assert.equal(valueAtPosition(256, 256, range), 128);
  assert.equal(valueAtPosition(160, 256, range), 80);
  assert.equal(valueAtPosition(-40, 256, range), 0, 'dragging past the left end pins to min');
  assert.equal(valueAtPosition(400, 256, range), 128, 'dragging past the right end pins to max');
  assert.equal(valueAtPosition(10, 0, range), 0, 'an unmeasured rail never divides by zero');
});

test('thumb position is the value as a fraction of the range', () => {
  assert.equal(fractionForValue(0, range), 0);
  assert.equal(fractionForValue(64, range), 0.5);
  assert.equal(fractionForValue(128, range), 1);
  assert.equal(fractionForValue(500, range), 1);
  assert.equal(fractionForValue(5, { max: 5, min: 5, step: 1 }), 0);
});

test('the threshold slider spans strict to coin-flip in single bits', () => {
  assert.deepEqual(THRESHOLD_RANGE, { max: 128, min: 0, step: 1 });
  // Every value the slider can produce round-trips through position and back.
  for (let value = THRESHOLD_RANGE.min; value <= THRESHOLD_RANGE.max; value += 1) {
    const x = fractionForValue(value, THRESHOLD_RANGE) * 300;
    assert.equal(valueAtPosition(x, 300, THRESHOLD_RANGE), value);
  }
});
