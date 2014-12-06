import
Ember
from
'ember';

export default
Ember.Handlebars.makeBoundHelper(function (value, downTo) {
    if (!value)
        return 0;
    else if(!downTo)
        return Math.round(x);
    else
        return Math.round(value/downTo)*downTo;
});
