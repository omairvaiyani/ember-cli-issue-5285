import Ember from 'ember';

function simpleDate(params) {
    var date = params.hash.date,
        format = params.hash.format;

    if (!format && typeof format !== "string")
        return new moment(date).format("MMM Do YYYY");
    else
        return new moment(date).format(format);
}

export {
    simpleDate
};

export default Ember.Handlebars.makeBoundHelper(simpleDate);
