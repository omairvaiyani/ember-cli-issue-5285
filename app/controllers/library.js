import Ember from 'ember';
import CurrentUser from '../mixins/current-user';

export default Ember.Controller.extend(CurrentUser, {

    beginGeneratingBoxes: function () {
        var _this = this;

        setTimeout(function () {
            _this.updateCreatedTestBoxes();
        }, 400);

        setTimeout(function () {
            _this.updateFavouritesTestBoxes();
        }, 600);

        setTimeout(function () {
            _this.updateRecentTestBoxes();
        }, 800);

    }.on('init'),

    maxBoxesPerList: 10,

    boxTypes: function () {
        var boxTypes = [
            Ember.Object.create({
                list: "createdTests",
                title: "Created",
                addItemLabel: "Create a New Quiz",
                addItemRoute: "create",
                boxes: new Ember.A()
            }),
            Ember.Object.create({
                list: "savedTests",
                title: "Favourites",
                addItemLabel: "Explore to Find Favourites",
                addItemRoute: "browse",
                boxes: new Ember.A()
            }),
            Ember.Object.create({
                list: "recentTests",
                title: "Recent",
                boxes: new Ember.A()
            })
        ];
        return new Ember.A().addObjects(boxTypes);
    }.property(),

    generateBoxes: function (boxType) {
        var _this = this,
            maxBoxesPerList = _this.get('maxBoxesPerList'),
            itemList = _this.get('currentUser.' + boxType.get('list')),
            moreItemsThanBoxes = itemList.get('length') > maxBoxesPerList,
            boxes = new Ember.A();

        var isLastBox = function (i) {
            return i === (maxBoxesPerList - 1);
        };

        var remainingItems = function (list) {
            return list.get('length') - (maxBoxesPerList - 1);
        };

        var lastItemShown = false;
        for (var i = 0; i < maxBoxesPerList; i++) {
            var box = new Ember.Object();

            if (isLastBox(i) && moreItemsThanBoxes) {
                box.set('remaining', remainingItems(itemList));
            } else if (lastItemShown) {
                box.set('isEmpty', true);
            } else if (itemList.objectAt(i)) {
                box.set('item', itemList.objectAt(i));
            } else if (!lastItemShown) {
                if (boxType.get('addItemLabel')) {
                    box.set('addItem', true);
                    box.set('addItemLabel', boxType.get('addItemLabel'));
                    box.set('addItemRoute', boxType.get('addItemRoute'));
                }
                lastItemShown = true;
            }

            boxes.pushObject(box);
        }
        boxType.get('boxes').clear();
        boxType.get('boxes').addObjects(boxes);
    },

    updateCreatedTestBoxes: function () {

        this.generateBoxes(this.get('boxTypes').findBy("list", "createdTests"));

    }.observes('currentUser.createdTests.length'),

    updateFavouritesTestBoxes: function () {

        this.generateBoxes(this.get('boxTypes').findBy("list", "savedTests"));

    }.observes('currentUser.savedTests.length'),

    updateRecentTestBoxes: function () {

        this.generateBoxes(this.get('boxTypes').findBy("list", "recentTests"));

    }.observes('currentUser.recentTests.length')
});
