import assert from 'node:assert/strict';
import test from 'node:test';

import { getResponsiveMetrics, scaleFont, scaleSpacing } from '../src/lib/responsive-metrics.ts';

test('gate responsive metrics stay compact on phones', () => {
  const metrics = getResponsiveMetrics({ height: 844, width: 390 });

  assert.equal(metrics.isTablet, false);
  assert.equal(metrics.isLandscape, false);
  assert.ok(metrics.contentMaxWidth >= 390);
  assert.ok(metrics.previewAspectRatio < 1);
});

test('gate responsive metrics constrain tablet landscape content', () => {
  const metrics = getResponsiveMetrics({ height: 768, width: 1024 });

  assert.equal(metrics.isTablet, true);
  assert.equal(metrics.isLandscape, true);
  assert.equal(metrics.contentMaxWidth, 620);
  assert.equal(metrics.wideContentMaxWidth, 820);
  assert.equal(metrics.previewFrameMaxWidth, 760);
  assert.ok(metrics.previewAspectRatio > 1);
});

test('gate tablet sizing boosts fonts and spacing slightly', () => {
  const metrics = getResponsiveMetrics({ height: 1194, width: 834 });

  assert.ok(scaleFont(metrics, 16) > 16);
  assert.ok(scaleSpacing(metrics, 20) > 20);
});
