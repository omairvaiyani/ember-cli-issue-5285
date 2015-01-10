import Ember from 'ember';

export default Ember.TextField.extend({
        init: function () {
            this._super();
            this.on("keyUp", this, this.interpretKeyEvents);
        },

        /*classNameBindings: ['noMarginBottom::margin-bottom-16'],

        isFocused: false,

        selectedItemIndex: -1,

        selectedItem: null,

        numberOfItemsOmitted: 0,*/

        /*
         * If a isGrouped,
         * child objects (which should be
         * arrays) are given the same
         * treatment as the 'array'
         * property below
         */
        /*groups: function () {
            if (!this.get('isGrouped'))
                return;
            var groups = [];
            for (var i = 0; i < this.get('data.length'); i++) {
                var group = this.get('data')[i];
                group.records = this.mapArray(group.records, group);
                groups.push(group);
            }
            return groups;
        }.property('data.length'),*/

        /*
         * Takes the provided data (has to be an array)
         * and maps it to a simple analogous key/value
         * array, limited to the given limit or default
         * to 5.
         */
        /*array: function () {
            if (!this.get('data') || this.get('isGrouped'))
                return [];

            return this.mapArray(this.get('data'));
        }.property('data.length'),
*/
        /*
         * Takes provided array and maps the
         * objects with the generic keys
         * for universal usage.
         * Also handles limits and numberOmitted.
         */
        /*mapArray: function (array, group) {
            if (!this.get('limit'))
                this.set('limit', 5);

            if (this.get('totalCount') > this.get('limit'))
                this.set('numberOfItemsOmitted', (this.get('totalCount') - this.get('limit')));
            else
                this.set('numberOfItemsOmitted', 0);

            *//*
             * key is provided by groups if isGrouped,
             * else this.key is set on component creation
             *//*
            var key,
                imageKey,
                className;
            if (group) {
                key = group.key;
                className = group.className;
                imageKey = group.imageKey;
            } else
                key = this.get('key');


            return array.splice(0, this.get('limit')).map(function (item) {
                if (item['key'])
                    return item;

                var itemKey = item[key];
                if (!itemKey)
                    itemKey = item.get(key);
                return {
                    key: itemKey,
                    imageUrl: item[imageKey],
                    object: item,
                    className: className
                };
            }.bind(this));
        },*/

        /*
         * Show or hide the autocomplete suggestions
         * depending on whether the textfield is focused
         *
         * focusout() is avoided as we want users to be
         * able to click on the suggestions without hiding
         * them!
         */
       /* toggleAutocompleteContainer: function () {
            this.$().focus(function () {
                this.set('isFocused', true);
            }.bind(this));

            $("body").click(function (event) {
                if (!this.$())
                    return;
                if (($(event.target)[0] === this.$()[0]) ||
                    ($(event.target).offsetParent()[0].className === "autocomplete-container")
                ) {
                    return;
                } else {
                    this.set('isFocused', false);
                }
            }.bind(this));
        }.on('didInsertElement'),*/

        interpretKeyEvents: function (event) {
            var map = this.KEY_EVENTS;
            var method = map[event.keyCode];
            if (method) {
                return this.get('contextController').send(method);
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
