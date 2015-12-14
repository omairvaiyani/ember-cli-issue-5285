import Ember from 'ember';

export default Ember.Component.extend({
    /**
     * @Property Checkbox Dynamic Id
     * Dynamic id needed for the
     * checkbox as Edit Test
     * page has multiple instances
     * of this: cannot have duplicate
     * ids.
     */
    checkboxDynamicId: function () {
        return "privacy-switch-" + $(this)[0].elementId;
    }.property()
});
