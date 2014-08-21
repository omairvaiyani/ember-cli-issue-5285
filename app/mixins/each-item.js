import Ember from 'ember';

export default Ember.Mixin.create({
    itemIndex: function () {
        if(!this.get('array') || !this.get('array.length'))
            return;

        var model = this.get('model'),
            idx = this.get('array').indexOf(model);
        return idx;
    }.property('array.length'),

    itemNumber: function() {
        return this.get('itemIndex') + 1;
    }.property('itemIndex')
});
