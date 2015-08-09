import Ember from 'ember';

export default Ember.Mixin.create({
    /**
     * @Property
     * For the User to order the tests
     * on the my tests list by the select
     * drop down list.
     */
    listOrders: [
        {value: 'title', label: "Title A-Z", reverse: false},
        {value: 'memoryStrength', label: "Memory (Weakest first)", reverse: false},
        {value: 'memoryStrength', label: "Memory (Strongest first)", reverse: true},
        {value: 'difficulty', label: "Difficulty (Easiest first)", reverse: false},
        {value: 'difficulty', label: "Difficulty (Hardest first)", reverse: true},
        {value: 'createdAt', label: "Newest first", reverse: true},
        {value: 'createdAt', label: "Oldest first", reverse: false}
    ],

    /**
     * @Property
     * The selected sorting method, e.g. by
     * title vs. createdAt etc.
     */
    listOrder: function () {
        if (localStorage.getObject(this.get('controllerId') + "ListOrder"))
            return _.findWhere(this.get('listOrders'),
                {
                    value: localStorage.getObject(this.get('controllerId') + "ListOrder").value,
                    reverse: localStorage.getObject(this.get('controllerId') + "ListOrder").reverse
                });
        else
            return this.get('listOrders')[0];
    }.property(),

    /**
     * @Property
     * Stores the list order on the client browser
     * If set, it will be set by init on next load.
     */
    storeMyTestsListOrderLocally: function () {
        localStorage.setObject(this.get('controllerId') + 'ListOrder', this.get('listOrder'));
    }.observes('listOrder')

});
