import Ember from 'ember';
import CurrentUser from '../../mixins/current-user';
import ParseHelper from '../../utils/parse-helper';

export default Ember.Route.extend(CurrentUser, {
    model: function () {
        var where = {
            author: ParseHelper.generatePointer(this.get('currentUser'), '_User'),
            isSpacedRepetition: true
        };
        return this.store.find('test', {where: JSON.stringify(where)})
            .then(function (results) {
                if (results.objectAt(0)) {
                    return results.objectAt(0);
                } else {
                    Parse.Cloud.run('getSRSTestForUser', {})
                        .then(function (srsTest) {

                        });
                }
            });
    }
});
