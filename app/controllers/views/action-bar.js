import Ember from 'ember';

export default Ember.Controller.extend({
    title: '',
    objectsController: null,
    modelType: '',
    objects: [],
    updateTitle: function() {
        switch (this.get('objects.length')) {
            case 0:
                this.set('title', "");
                break;
            case 1:
                this.set('title', "1 " + this.get('modelType') + " selected.");
                break;
            default:
                this.set('title',  this.get('objects.length') + " " + this.get('modelType') + " selected.");
                break;
        }
    }.observes('objects.length'),
    addObject: function (objectsController, object) {
        if (!this.get('modelType')) {
            this.set('modelType', object.constructor.typeKey);
            this.set('objectsController', objectsController);
        }
        else if (this.get('modelType') !== object.constructor.typeKey) {
            // TODO Heterogenous objects added
            this.set('objects', []);
            this.set('modelType', object.constructor.typeKey);
            this.set('objectsController', objectsController);
        }
        this.get('objects').pushObject(object);
    },
    removeObject: function (object) {
        var index = this.get('objects').indexOf(object);
        if (index !== -1)
            this.get('objects').removeObject(object);
    },
    deleteAllObjects: function () {
        this.get('objectsController').send('deleteObjectsInActionBar',this.get('objects'));
        this.set('objects', []);
    }
});
