import Ember from 'ember';

export function friendlyIndex(params) {
    var index = params[0];
    if(!index)
        index = 0;
    return ++index;
}

export default Ember.HTMLBars.makeBoundHelper(friendlyIndex);
