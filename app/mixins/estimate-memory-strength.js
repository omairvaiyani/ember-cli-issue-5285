import Ember from 'ember';
import ParseHelper from '../utils/parse-helper';

export default Ember.Mixin.create({
    /**
     * @Property Tests to Figure Out Memory Strength For
     *
     */
    testsToFigureOutMemoryStrengthFor: new Ember.A(),

    figureOutMemoryStrengthForSomeTests: function () {
        if (!this.get('testsToFigureOutMemoryStrengthFor.length'))
            return;
        var testPointers = ParseHelper.generatePointers(this.get('testsToFigureOutMemoryStrengthFor'));
        ParseHelper.cloudFunction(this, 'getMemoryStrengthForTests', {tests: testPointers})
            .then(function (response) {
                // For tests without URs, we have estimated memory strengths
                _.each(response.estimates, function (object) {
                    var test = this.get('testsToFigureOutMemoryStrengthFor').findBy('id', object.test.objectId);
                    test.set('estimatedMemoryStrength', object.estimatedMemoryStrength);
                }.bind(this));

                // This automatically triggers tests.@each.uniqueResponses to update from data store.
                ParseHelper.extractRawPayload(this.store, 'unique-response', response.uniqueResponses);

                // This stops the test-card component from asking to fetch memory strength data again.
                this.get('testsToFigureOutMemoryStrengthFor').forEach(function (test) {
                    test.set('memoryStrengthDataHasBeenFetched', true);
                });

                this.get('testsToFigureOutMemoryStrengthFor').clear();
            }.bind(this), function (error) {
                console.dir(error);
            });
    },

    throttleFigureOutMemoryStrengthForSomeTests: function () {
        Ember.run.debounce(this, this.figureOutMemoryStrengthForSomeTests, 200);
    }.observes('testsToFigureOutMemoryStrengthFor.length'),

    actions: {
        // Receives call from test-card, be it in browse, myTests or elsewhere
        fetchMemoryStrengthDataForTest: function (test) {
            this.get('testsToFigureOutMemoryStrengthFor').pushObject(test);
        }
    }
});
