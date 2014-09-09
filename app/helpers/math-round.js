import
Ember
from
'ember';

export default
Ember.Handlebars.makeBoundHelper(function (value, dp) {
    if (!value)
        return 0;
    else
        return Math.round(value);
});
