import Ember from 'ember';
import ImageUploadMixin from 'mycqs-web/mixins/image-upload';

module('ImageUploadMixin');

// Replace this with your real tests.
test('it works', function() {
  var ImageUploadObject = Ember.Object.extend(ImageUploadMixin);
  var subject = ImageUploadObject.create();
  ok(subject);
});
