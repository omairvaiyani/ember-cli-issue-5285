import ParseHelper from '../utils/parse-helper';

export default {
    name: 'session',
    after: 'parse-user-reopen',

    initialize: function (container, application) {
        var sessionToken = localStorage.sessionToken;
        if (sessionToken) {
            application.deferReadiness();
            var store = container.lookup('store:main'),
                ParseUser = store.modelFor('parse-user'),
                currentUser;

            ParseUser.validateSessionToken(store, sessionToken)
                .then(function (user) {
                    if (!user)
                        return;
                    currentUser = user;
                    application.register('user:current', currentUser, {instantiate: false, singleton: true});
                    application.inject('controller:application', 'currentUser', 'user:current');
                }, function (error) {
                    console.dir(error);
                }).then(function () {
                    application.advanceReadiness();
                });

        }
    }
};
