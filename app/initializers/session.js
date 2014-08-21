export default {
        name: 'session',
        after: 'parse-user-reopen',

        initialize: function (container, application) {
            application.deferReadiness();

            var sessionToken = localStorage.sessionToken;

            if (sessionToken) {
                var store = container.lookup('store:main');
                var ParseUser = store.modelFor('parse-user');

                ParseUser.validateSessionToken(store, sessionToken).then(
                    function (userMinimal) {
                        store.findById('parse-user', userMinimal.get('id')).then(function(user) {
                            application.register('user:current', user, { instantiate: false, singleton: true });
                            application.inject('route', 'currentUser', 'user:current');
                            application.inject('controller', 'currentUser', 'user:current');
                            application.advanceReadiness();
                        });
                    },
                    function (error) {
                        console.dir(error);
                        application.advanceReadiness();
                    }
                );
            } else
                application.advanceReadiness();

        }
};
