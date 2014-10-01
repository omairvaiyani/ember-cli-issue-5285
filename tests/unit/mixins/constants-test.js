import Ember from 'ember';
import ConstantsMixin from 'mycqs-web/mixins/constants';

module('ConstantsMixin');

// Replace this with your real tests.
test('it works', function() {
  var ConstantsObject = Ember.Object.extend(ConstantsMixin);
  var subject = ConstantsObject.create();
  ok(subject);
});
