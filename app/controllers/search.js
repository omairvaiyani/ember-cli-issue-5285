import Ember from 'ember';
import CurrentUser from '../mixins/current-user';
import ParseHelper from '../utils/parse-helper';

export default Ember.Controller.extend(CurrentUser, {
    needs: ['application'],
    /**
     * Init component and override
     * keyUp events. Allows us to
     * provide arrow controls for
     * user to select suggestions.
     */
    /*init: function () {
     this._super();
     },*/

    /**
     * @Property engineKey
     * Swifttype engineKey
     */
    engineKey: "KpTvAqftjz7ZaGG7FPr7",

    /**
     * @Property engineUrl
     * Swiftype engine url for searching
     * records.
     */
    engineUrl: "https://api.swiftype.com/api/v1/public/engines/suggest.json",

    /**
     * @Property isLoading
     * Used by loading-bar view
     */
    isLoading: false,

    /**
     * @Property type
     * Record document type
     * Currently have users, tests,
     * courses, institutions
     */
    //type: null,

    /**
     * @Property subtype
     * Record document subtype
     * E.g. University vs School
     * in type educational-institutions
     */
    //subtype: null,

    /**
     * @Property inputText
     * The user's search input
     */
    inputText: "",
    updateInputText: function () {
        this.set('inputText', this.get('controllers.application.searchInputText'));
    }.observes('controllers.application.searchInputText.length'),

    /**
     * @Property selectedItem
     * What the user selects from
     * the suggestions.
     * Cannot be preset on component
     * creation as this is mapped
     * generically.
     */
    //selectedItem: null,

    /**
     * @Property defaultItem
     * Provided on component creation,
     * if present, map defaultItem
     * to selectedItem on 'init'.
     */
    //defaultItem: null,

    /*defaultItemDidChange: function () {
     if (this.get('defaultItem'))
     this.set('selectedItem', this.mapItem(this.get('defaultItem')));
     else
     this.set('selectedItem', null);
     }.observes('defaultItem', 'subtype'),*/

    /**
     * @Property dataRecords
     * Return from the cloud and is updated
     * on inputText change through REST API.
     */
    dataRecords: null,

    searchEngine: function () {
        /*if (this.get('facebookSearch') && this.get('currentUser.fbid'))
         return "facebook";
         else*/
        return "swiftype";
    }.property('facebookSearch', 'currentUser.fbid.length'),

    /**
     * @Function getDataForSuggestions
     * Solely using Swiftype for suggestions.
     * Parse does not have practical search
     * functionality and using it is a
     * waste of time.
     */
    getDataForSuggestions: function () {
        if (!this.get('dataRecords'))
            this.set('dataRecords', new Ember.A());

        if (!this.get('inputText.length'))
            return this.get('dataRecords').clear();

        this.set('isLoading', true);
        var params = {
            q: this.get('inputText').toLowerCase(),
            engine_key: this.get('engineKey')
        };
        var preloadInput = this.get('inputText');
        // swiftype autocomplete
        $.getJSON(this.get('engineUrl'), params)
            .done(function (data) {
                if (this.get('inputText') === preloadInput) {
                    this.get('dataRecords').clear();
                    var records = data.records;
                    var tests = records.tests,
                        testPointers;
                    _.each(tests, function (test) {
                       testPointers.push(ParseHelper.generatePointerFromIdAndClass(test.external_id, "Test"));
                    });
                    var where = {
                        "objectId": {
                            "$in": testPointers
                        }
                    }
                    this.set('isLoading', false);
                }
            }.bind(this));
    },
    /**
     * @Function throttleSearch
     * Rate limit - stop excessive API calls
     */
    throttleSearch: function () {
        if (this.get('inputText.length'))
            this.set('isLoading', true);
        Ember.run.debounce(this, this.getDataForSuggestions, 200);
    }.observes("inputText.length"),

    /**
     * @Property limit
     * How many suggestions to show.
     * Default 10, but can be set
     * on component creation.
     * 0 = no limit.
     */
    limit: 10,

    /**
     * @Property suggestions
     * The list of suggestions ready
     * for use by the component template.
     * Takes the provided date and
     * maps the array and splices to limit.
     */
    suggestions: null,

    updateSuggestions: function () {
        this.set('focusedItem', null);
        this.set('focusedItemIndex', -1);

        if (!this.get('suggestions'))
            this.set('suggestions', new Ember.A());

        this.get('suggestions').clear();
        if (!this.get('dataRecords.length'))
            return;

        var suggestions = this.mapSuggestions(this.get('dataRecords'));
        if (!suggestions)
            return;

        if (this.get('limit'))
            this.get('suggestions').addObjects(suggestions.splice(0, this.get('limit')));
        else
            this.get('suggestions').addObjects(suggestions);
    }.observes('dataRecords.length'),

    /**
     * @Function Map Array
     * Takes provided array and maps the
     * objects with the labelPaths
     * for universal usage.
     */
    mapSuggestions: function (array) {
        if (!array)
            return;
        return array.map(function (item) {
            return this.mapItem(item);
        }.bind(this));
    },
    /**
     * @Function mapItem
     *
     * Converts provided items
     * into a generic object
     * usable by component templates.
     */
    mapItem: function (item) {
        var label,
            secondaryLabel,
            imageUrl;

        if (typeof item.get === 'function')
            label = item.get(this.get('labelPath'));
        else
            label = item[this.get('labelPath')];

        if (this.get('secondaryLabelPath')) {
            if (typeof item.get === 'function')
                secondaryLabel = item.get(this.get('secondaryLabelPath'));
            else
                secondaryLabel = item[this.get('secondaryLabelPath')]
        }

        if (this.get('imageUrlPath')) {
            if (typeof item.get === 'function')
                imageUrl = item.get(this.get('imageUrlPath'));
            else
                imageUrl = item[this.get('imageUrlPath')]
        }

        var object = new Ember.Object();
        object.set('label', label);
        object.set('secondaryLabel', secondaryLabel);
        object.set('imageUrl', imageUrl);
        item['recordType'] = this.get('searchEngine');
        object.set('record', item);
        object.set('type', this.get('type'));
        return object;
    },

    /*   facebookSearchFilter: function (data) {
     var results = [],
     type = this.get('type');
     _.each(data, function (object) {
     switch (type) {
     case "educational-institutions":
     if (this.get('subtype')) {
     if (object.category === this.get('subtype'))
     results.push(object);
     } else {
     if (object.category === "University" || object.category === "School")
     results.push(object);
     }
     break;
     case "study-fields":
     if (object.category === "Interest" || object.category === "Field of study")
     results.push(object);
     break;
     }
     if (this.get('limit') && data.length === this.get('limit'))
     return;
     }.bind(this));
     return results;
     },*/

    /**
     * @Property focusedItem
     * @Property focusedItemIndex
     * Item currently highlighted by
     * the user when using arrow controls.
     * Used when they press 'enter', we
     * need to know what item is focused.
     */
    //focusedItem: null,
    //focusedItemIndex: -1,

    actions: {
        /*itemSelected: function (item) {
         this.set('focusedItem', null);
         this.set('focusedItemIndex', -1);
         this.set('selectedItem', item);
         this.send('enter');
         },

         enter: function () {
         if (this.get('focusedItem')) {
         this.set('selectedItem', this.get('focusedItem'));
         }
         if (!this.get('selectedItem'))
         this.get('contextController').send(this.get('actionOnSelection'), null, this.get('inputText'));
         else {
         this.get('contextController').send(this.get('actionOnSelection'), this.get('selectedItem.record'));
         }
         this.send('clearSuggestions');
         },*/

        clearSuggestions: function () {
            this.set('focusedItem', null);
            this.set('focusedItemIndex', -1);
            this.set('inputText', "");
            this.get('dataRecords').clear();
        },

        /*
         * When user clicks on the selected
         * item, allows them to edit and
         * continue searching.
         */
        /* editSelectedItem: function () {
         this.set('inputText', this.get('selectedItem.label'));
         this.set('selectedItem', null);
         },

         focusItem: function () {
         // Clear previous focusedItem.
         this.get('suggestions').forEach(function (item) {
         item.set('isFocused', false);
         });
         var item = this.get('suggestions').objectAt(this.get('focusedItemIndex'));
         if (item) {
         item.set('isFocused', true);
         this.set('focusedItem', item);
         }
         },*/

        /*
         * Highlight items with the use of arrow keys
         */
        /*arrowDown: function () {
         if ((this.get('focusedItemIndex') + 1) < this.get('suggestions.length')) {
         this.incrementProperty('focusedItemIndex');
         this.send('focusItem');
         }
         },
         arrowUp: function () {
         if (this.get('focusedItemIndex') > 0) {
         this.decrementProperty('focusedItemIndex');
         this.send('focusItem');
         } else {
         this.set('focusedItemIndex', -1);
         this.send('focusItem');
         }
         }*/
    }
});