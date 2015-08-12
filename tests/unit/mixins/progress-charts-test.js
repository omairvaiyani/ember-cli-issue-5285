import Ember from 'ember';
import ProgressChartsMixin from '../../../mixins/progress-charts';
import { module, test } from 'qunit';

module('Unit | Mixin | progress charts');

// Replace this with your real tests.
test('it works', function(assert) {
  var ProgressChartsObject = Ember.Object.extend(ProgressChartsMixin);
  var subject = ProgressChartsObject.create();
  assert.ok(subject);
});
