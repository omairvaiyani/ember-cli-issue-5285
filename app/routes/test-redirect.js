import Ember from 'ember';

export default Ember.Route.extend({
   model: function (params) {
       var where = {
           oldId: params.test_old_id
       };
       this.store.findQuery('test', {where: JSON.stringify(where)})
           .then(function (tests) {
              if(tests && tests.objectAt(0)) {
                  var test = tests.objectAt(0);
                  this.transitionTo('testInfo', test.get('slug'));
                  return;
              } else {
                  this.transitionTo('notFound');
              }
           }.bind(this));
   }
});
