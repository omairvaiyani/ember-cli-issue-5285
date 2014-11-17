import
    Ember
    from
        'ember';

import
    EachItem
    from
        '../../../../../mixins/each-item';


import
    CurrentUser
    from
        '../../../../../mixins/current-user';

export default
    Ember.ObjectController.extend(EachItem, CurrentUser, {
        messageToDisplay: function () {
            switch (this.get('type')) {
                case 'challenge':
                    return "challenged you to take this test!";
                case 'SRS':
                    return this.get('message');
            }
        }.property('type'),
        array: function () {
            return this.get('currentUser.messages');
        }.property('currentUser.messages.length')
    });
