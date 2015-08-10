import Ember from 'ember';
import DeleteWithUndoMixin from '../../../mixins/delete-with-undo';
import { module, test } from 'qunit';

module('Unit | Mixin | delete with undo');

// Replace this with your real tests.
test('it works', function(assert) {
  var DeleteWithUndoObject = Ember.Object.extend(DeleteWithUndoMixin);
  var subject = DeleteWithUndoObject.create();
  assert.ok(subject);
});
