import Ember from 'ember';

function simpleDate(date) {
    return new moment(date).format("MMM Do YYYY");
}

export {
    simpleDate
    };

export default Ember.Handlebars.makeBoundHelper(simpleDate);
