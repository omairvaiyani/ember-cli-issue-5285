import
Ember
from
'ember';

export default
Ember.TextField.extend({
    init: function () {
        this._super();
        this.on("keyUp", this, this.interpretKeyEvents);
    },

    classNameBindings: ['noMarginBottom::margin-bottom-16'],

    isFocussed: false,

    selectedItemIndex: -1,

    selectedItem: null,

    numberOfItemsOmitted: 0,

    /*
     * Takes the provided data (has to be an array)
     * and maps it to a simple analogous key/value
     * array, limited to the given limit or default
     * to 5.
     */
    array: function () {
        if (!this.get('data'))
            return [];

        if (!this.get('limit'))
            this.set('limit', 5);

        if (this.get('totalCount') > this.get('limit'))
            this.set('numberOfItemsOmitted', (this.get('totalCount') - this.get('limit')));
        else
            this.set('numberOfItemsOmitted', 0);

        return this.get('data').splice(0, this.get('limit')).map(function (item) {
            return {
                key: item[this.get("key")],
                object: item
            };
        }.bind(this));
    }.property('data.length'),

    /*
     * Show or hide the autocomplete suggestions
     * depending on whether the textfield is focussed
     *
     * focusout() is avoided as we want users to be
     * able to click on the suggestions without hiding
     * them!
     */
    toggleAutocompleteContainer: function () {
        this.$().focus(function () {
            this.set('isFocussed', true);
        }.bind(this));

        $("body").click(function (event) {
            if(!this.$())
                return;
            if (($(event.target)[0] === this.$()[0]) ||
                ($(event.target).offsetParent()[0].className === "autocomplete-container")
                ) {
                return;
            } else {
                this.set('isFocussed', false);
            }
        }.bind(this));
    }.on('didInsertElement'),

    actions: {
        /*
         * Highlight items with the use of arrow keys
         */
        arrowDown: function () {
            if ((this.get('selectedItemIndex') + 1) < this.get('array.length')) {
                this.incrementProperty('selectedItemIndex');
                this.set('selectedItem', this.get('array').objectAt(this.get('selectedItemIndex')));
            }
        },
        arrowUp: function () {
            if (this.get('selectedItemIndex') > 0) {
                this.decrementProperty('selectedItemIndex');
                this.set('selectedItem', this.get('array').objectAt(this.get('selectedItemIndex')));
            } else {
                this.set('selectedItemIndex', -1);
                this.set('selectedItem', null);
            }
        },
        /*
         * If an item is being highlighted, pressing enter
         * will set that items key to the textfield value
         * WITHOUT alerting ember observeables.
         *
         * This is to avoid unneccesary updates to the data
         * array which is likely bound to the value.length.
         *
         * A better outcome would be to set a second property
         * to observe the final selected item by the user.
         * --
         * Ember.Observable is being bypassed by using
         * jQuery .val() which updates the textfield value
         * without alerting any observables.
         */
        enter: function () {
            if (this.get('selectedItem')) {
                //this.$().val(this.get('selectedItem.key'));
                if(this.get('itemAction')) {
                    this.get('parentController').send(this.get('itemAction'), this.get('selectedItem.object'));
                }
                this.set('selectedItemIndex', -1);
                this.set('selectedItem', null);
            } else {
                if(this.get('action')) {
                    this.get('parentController').send(this.get('action'));
                }
            }
            this.set('isFocussed', false);
        },

        /*
         * Called by user clicking on an autocomplete suggestion.
         *
         * Replicates the effect of using arrows to select
         * an item and pressing enter to select it.
         */
        itemSelected: function (item) {
            this.set('selectedItem', item);
            this.send('enter');
        },

        seeAllResults: function () {
            this.get('parentController').send('seeAllResults');
        }
    },

    interpretKeyEvents: function (event) {
        this.set('isFocussed', true);
        var map = this.KEY_EVENTS;
        var method = map[event.keyCode];
        if (method) {
            return this.send(method);
        } else {
            this._super(event);
        }
    },

    KEY_EVENTS: {
        38: 'arrowUp',
        40: 'arrowDown',
        13: 'enter'
    }

});
