import Ember from 'ember';

export default Ember.View.extend({
    classNames: ['profile-picture'],

    /*
     * Binds the html attribute 'style'
     * to the view property below
     */
    attributeBindings: ['style'],

    style: function () {
        var url = this.get('user.profileImageURL');

        if (url)
            return "background-image:url(" + url + ");";
    }.property('user')
});
