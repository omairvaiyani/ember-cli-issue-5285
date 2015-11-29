import Ember from 'ember';
import ParseHelper from '../utils/parse-helper';

export default Ember.Controller.extend({
    hotTests: new Ember.A(),

    getHotTests: function () {
        ParseHelper.cloudFunction(this, 'getHotTests', {}).then(function (response) {
            var tests = ParseHelper.extractRawPayload(this.store, 'test', response.hotTests);
            this.get('hotTests').clear();
            this.get('hotTests').addObjects(tests);
        }.bind(this), function (error) {
            console.dir(error);
        });
    }.on('init')
});
