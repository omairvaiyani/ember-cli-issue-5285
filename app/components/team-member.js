import Ember from 'ember';

export default Ember.Component.extend({
    memberImageStyle: function () {
        var url = this.get('imageUrl');
        return "background:url('"+url+"');";
    }.property("imageUrl"),

    twitterUrl: function () {
        return "https://twitter.com/" + this.get('twitter');
    }.property('twitter.length'),

    twitterTitle: function () {
        var firstName = this.get('name').split(" ")[0];
        return "Follow "+firstName+" on Twitter!";
    }.property('name.length'),

    linkedInUrl: function () {
        return "https://linkedin.com/in/" + this.get('linkedIn');
    }.property('linkedIn.length'),

    linkedInTitle: function () {
        var firstName = this.get('name').split(" ")[0];
        return "Connect with "+firstName+" on Linkedin!";
    }.property('name.length'),

    emailTitle: function () {
        var firstName = this.get('name').split(" ")[0];
        return "Send "+firstName+" an email!";
    }.property('name.length'),

    mailTo: function () {
        return "mailto:"+this.get('email');
    }.property('email.length')
});
