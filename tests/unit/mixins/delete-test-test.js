import Ember from 'ember';
import DeleteTestMixin from '../../../mixins/delete-test';
import { module, test } from 'qunit';

module('Unit | Mixin | delete test');

// Replace this with your real tests.
test('it works', function(assert) {
  var DeleteTestObject = Ember.Object.extend(DeleteTestMixin);
  var subject = DeleteTestObject.create();
  assert.ok(subject);
});
