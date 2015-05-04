import {
    moduleFor,
    test
    } from 'ember-qunit';
import startApp from '../../helpers/start-app';
var App;

moduleFor('controller:create', 'CreateController', {
    // Specify the other units that are required for this test.
    needs: ['controller:application', 'controller:editQuestion', 'controller:join',
        'controller:index', 'controller:user', 'controller:test', 'controller:category'],
    setup: function() {
        App = startApp();
    },
    teardown: function() {
        Ember.run(App, 'destroy');
    }
});

// Replace this with your real tests.
test('it exists', function() {
    var controller = this.subject();
    ok(controller);
});

test('stop empty test creation',  function () {
    visit("/create");
    var controller = this.subject();
    controller.send('checkTest');
    equal(controller.get('checkTestError'), true, "No input");

    controller.set('title', "Test title");
    controller.send('checkTest');
    equal(controller.get('checkTestError'), true, "No category");

    controller.set('title', "");
    controller.set('category', {});
    controller.send('checkTest');
    equal(controller.get('checkTestError'), true, "No title");

    controller.set('title', "Test title");
    controller.set('category', {});
    controller.send('checkTest');
    equal(controller.get('checkTestError'), false, "Allowed when title and category are set");
});