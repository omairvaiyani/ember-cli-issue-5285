import Ember from 'ember';

export default Ember.View.extend({
    classNames: ['profile-image'],

    /*
     * Binds the html attribute 'style'
     * to the view property below
     */
    attributeBindings: ['style'],

    /*
     * The view's controller will either be:
     * - ProfileImageController, if {{render}}
     * - Parent context, if {{view}}
     * Only insert this view if the contextual model
     * is a ParseUser
     */
    style: function() {
        var url = this.get('controller.model');

        if(this.get('controller.model.profileImageURL'))
            url = this.get('controller.model.profileImageURL');

        return "background-image:url("+url+");";
    }.property('controller.model.profileImageURL')
});
