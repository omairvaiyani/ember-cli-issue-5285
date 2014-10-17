import
Ember
from
'ember';

export default
Ember.ArrayController.extend({
    needs: 'application',

    currentPath: function () {
        return this.get('controllers.application.currentPath');
    }.property('controllers.application.currentPath'),

    totalTests: null,

    getTotalTests: function () {
        this.store.findQuery('test', {count: 1})
            .then(function (results) {
                this.set('totalTests', results.meta.count);
            }.bind(this));
    }.observes('content.length'),

    isGridReady: false,

    createDynamicGrid: function () {
        if (this.get('currentPath') !== 'browse' || this.get('categoryStylesReady') < this.get('content.length'))
            return;
        setTimeout(function() {
            var wall = new freewall('#top-category-container');
            wall.reset({
                onResize: function () {
                    wall.fitWidth();
                },
                animation: true
            });
            wall.fitWidth();
            this.set('isGridReady', true);
            this.send('decrementLoadingItems');
            this.send('prerenderReady');
        }.bind(this), 1000);
    }.observes('categoryStylesReady', 'currentPath'),

    categoryStylesReady: 0
});
