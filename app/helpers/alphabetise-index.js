import Ember from 'ember';

export default Ember.Handlebars.makeBoundHelper(function (index) {
    if (typeof index === 'undefined')
        return "";
    return ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
        "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z"][index].toUpperCase();
});
