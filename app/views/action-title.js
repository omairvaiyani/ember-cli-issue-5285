import Ember from 'ember';
/*
 * Action title
 * - Model: Action
 * - Output: p with links
 */
export default Ember.View.extend({
    tagName: 'p',

    classNames: [''],

    template: Ember.Handlebars.compile('{{view.output}}'),

//    linkToUser: function() {
//        var userAction = this.get('value');
//        console.dir(userAction);
//        console.dir(userAction.get('user'));
//        return "{{#link-to 'user' "+userAction.get('user').get('id')+"}}"
//            +userAction.get('user').get('name')+"{{/link-to}}";
//    }.property('value.user.id'),

    /*
     * valueBinding gives the model as 'value'
     */
    output: function() {
        var userAction = this.get('value');
        var title = userAction.get('user').get('name');

        switch (userAction.get('type')) {
            case "joinedMyCQs":
                title += " joined MyCQs!";
                break;
            case "testCreated":
                title += " created a new test";
                break;
            case "attemptFinished":
                title +=  " took a test";
                break;
        }
        return title;
    }.property('value'),
});
