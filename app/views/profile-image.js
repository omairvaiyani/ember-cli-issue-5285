import Ember from 'ember';

export default Ember.View.extend({
    classNames: ['profile-picture'],

    /*
     * Binds the html attribute 'style'
     * to the view property below
     */
    attributeBindings: ['style'],

    style: function () {
        var url = this.get('user.profileImageURL'),
            style = "";
        if (url)
            style += "background-image:url(" + url + ");";
        if (this.get('height'))
            style += "height:" + this.get('height') + "px;";
        if (this.get('width'))
            style += "width:" + this.get('width') + "px;";

        return style;
    }.property('user.profileImageURL.length')
});
