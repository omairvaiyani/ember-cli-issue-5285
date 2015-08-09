import Ember from 'ember';

import NotificationView from './application/notification';

export default Ember.CollectionView.extend({
    /**
     * @property {String[]} The array of concrete class names to put on this view's element
     */
    classNames: ['notification-container'],

    /**
     * @property {View} Our notification view class.
     * This determines what view class to render for each item in the content array
     */
    itemViewClass: NotificationView,

    /**
     * Binding to our controller's notifications array.
     * There will be an App.NotificationView rendered for each
     * guy in here.
     */
    content: Ember.computed.oneWay('controller.notifications')
});
